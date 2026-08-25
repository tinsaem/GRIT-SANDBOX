const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { authenticateToken } = require("../middleware/keycloakAuth");
const { getPeerMaxStudents } = require("../services/settings");

/* =============================================================================
   Skill verification.

   Peer model (per reviewer feedback):
     • "Peer" is NOT a role. A peer is a Student with peerVerifierEnabled=true.
     • A student may verify OTHER students, never their own skills.
     • Peers are drawn from the student list, so the same person can both be
       assessed and assess others under one registration.
     • A peer may only score a LIMITED number of distinct students. The limit
       is admin-configurable at runtime via platform_settings.peer_max_students.
   ========================================================================== */

// Scoring weights. "Peer" is kept here because historical rows in
// skill_verifications.verifier_role still carry that label, and their score
// must stay reproducible. New peer reviews are written as "Peer" too, so the
// weighting stays distinct from a Professor's or Employer's judgement.
const ROLE_WEIGHT = { Employer: 1.0, Professor: 0.8, Advisor: 0.7, Peer: 0.5, Student: 0.5 };

const STUDENT_TOKENS_PER_SKILL = 100;
const VERIFIER_POINTS_PER_SKILL = 500;

/* -----------------------------------------------------------------------------
   The peer cap is no longer hardcoded. It lives in platform_settings under the
   key "peer_max_students" and is editable by an Admin in the console
   (Settings tab). Read via getPeerMaxStudents():

       n  -> a student may evaluate at most n DISTINCT other students
       0  -> peer review disabled platform-wide
     null -> unlimited (stored as -1)

   Defaults to 1, matching the reviewer's "only for one peer".
   -------------------------------------------------------------------------- */

// Roles permitted to verify at all. Students are included because peer review
// is a student capability; the extra peerVerifierEnabled check happens below.
const VERIFIER_ROLES = ["Employer", "Professor", "Advisor", "Student"];

/* ============================================ GET /api/verifications/:studentId */
router.get("/:studentId", authenticateToken, async (req, res) => {
  try {
    const verifs = await prisma.skillVerification.findMany({
      where: { studentId: req.params.studentId },
      orderBy: { createdAt: "desc" },
      include: { verifier: { select: { name: true } } },
    });
    res.json(
      verifs.map((v) => ({
        id: v.id,
        skill_name: v.skillName,
        verifier_role: v.verifierRole,
        confidence: v.confidence,
        comment: v.comment,
        created_at: v.createdAt,
        verifier_name: v.verifier.name,
      }))
    );
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================================== GET /api/verifications/peer/quota */
/** Lets the UI show a student how much peer-review capacity they have left,
 *  instead of only discovering the cap when a submission is rejected. */
router.get("/peer/quota", authenticateToken, async (req, res) => {
  if (req.user.role !== "Student") {
    return res.json({ applicable: false });
  }
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { peerVerifierEnabled: true },
    });

    const distinct = await prisma.skillVerification.findMany({
      where: { verifierId: req.user.id },
      select: { studentId: true },
      distinct: ["studentId"],
    });

    const limit = await getPeerMaxStudents();

    res.json({
      applicable: true,
      enabled: me?.peerVerifierEnabled !== false,
      limit,                                     // null = unlimited, 0 = disabled
      used: distinct.length,
      remaining: limit === null ? null : Math.max(0, limit - distinct.length),
      verifiedStudentIds: distinct.map((d) => d.studentId),
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

/* ================================================= POST /api/verifications */
router.post("/", authenticateToken, async (req, res) => {
  const { student_id, skill_name, confidence, comment } = req.body;
  const actorRole = req.user.role;

  if (!student_id || !skill_name || !confidence)
    return res.status(400).json({ error: "student_id, skill_name, and confidence required" });

  if (!VERIFIER_ROLES.includes(actorRole))
    return res.status(403).json({
      error: "Only Employers, Professors, Advisors, or Students (peer review) can verify skills",
    });

  // A student can never verify their own skills — the core peer-review rule.
  if (req.user.id === student_id)
    return res.status(400).json({ error: "You cannot verify your own skills" });

  if (![1, 2].includes(Number(confidence)))
    return res.status(400).json({ error: "Confidence must be 1 (first-hand) or 2 (aware)" });

  try {
    // The target must be a Student. Ex-Peer accounts are now Students, so they
    // are correctly verifiable — which was impossible under the old model.
    const student = await prisma.user.findFirst({
      where: { id: student_id, role: "Student", isActive: true },
      select: { id: true, name: true },
    });
    if (!student) return res.status(404).json({ error: "Student not found or inactive" });

    // A verification written by a Student is a peer review. Label it "Peer" so
    // it carries peer weighting (0.5) rather than being confused with a
    // stakeholder assessment.
    const isPeerReview = actorRole === "Student";
    const verifierRole = isPeerReview ? "Peer" : actorRole;

    if (isPeerReview) {
      const me = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { peerVerifierEnabled: true },
      });
      if (me?.peerVerifierEnabled === false)
        return res.status(403).json({
          error: "Your peer-review privilege has been disabled by an administrator",
        });

      // Cap on how many DISTINCT students one peer may score — admin-set.
      const peerLimit = await getPeerMaxStudents();

      if (peerLimit === 0)
        return res.status(403).json({
          error: "Peer review is currently disabled by the administrator.",
          peerDisabled: true,
        });

      if (peerLimit !== null) {
        const already = await prisma.skillVerification.findMany({
          where: { verifierId: req.user.id },
          select: { studentId: true },
          distinct: ["studentId"],
        });
        const isNewStudent = !already.some((a) => a.studentId === student_id);
        if (isNewStudent && already.length >= peerLimit) {
          return res.status(403).json({
            error:
              peerLimit === 1
                ? "As a peer you may evaluate only one other student, and you have already done so."
                : `As a peer you may evaluate at most ${peerLimit} students. You have reached that limit.`,
            peerLimitReached: true,
            limit: peerLimit,
            used: already.length,
          });
        }
      }
    }

    const existing = await prisma.skillVerification.findUnique({
      where: {
        studentId_verifierId_skillName: {
          studentId: student_id,
          verifierId: req.user.id,
          skillName: skill_name,
        },
      },
    });
    if (existing)
      return res.status(409).json({ error: "You have already verified this skill for this student" });

    const verif = await prisma.$transaction(async (tx) => {
      const v = await tx.skillVerification.create({
        data: {
          studentId: student_id,
          verifierId: req.user.id,
          skillName: skill_name,
          verifierRole,
          confidence: Number(confidence),
          comment: comment || null,
        },
      });

      // Credit the student who was verified.
      await tx.tokenWallet.upsert({
        where: { userId: student_id },
        update: { balance: { increment: STUDENT_TOKENS_PER_SKILL } },
        create: { userId: student_id, balance: STUDENT_TOKENS_PER_SKILL },
      });
      await tx.tokenLedger.create({
        data: {
          kind: "skill_verified",
          amount: STUDENT_TOKENS_PER_SKILL,
          fromUserId: req.user.id,
          toUserId: student_id,
          fromLabel: verifierRole,
          toLabel: "Student",
          note: `Skill verification: ${skill_name}`,
        },
      });

      // Credit the verifier.
      await tx.tokenWallet.upsert({
        where: { userId: req.user.id },
        update: { balance: { increment: VERIFIER_POINTS_PER_SKILL } },
        create: { userId: req.user.id, balance: VERIFIER_POINTS_PER_SKILL },
      });
      await tx.tokenLedger.create({
        data: {
          kind: "verifier_points",
          amount: VERIFIER_POINTS_PER_SKILL,
          fromUserId: student_id,
          toUserId: req.user.id,
          fromLabel: "Platform",
          toLabel: verifierRole,
          note: `Verifier earned points for: ${skill_name}`,
        },
      });

      return v;
    });

    res.status(201).json({
      id: verif.id,
      message: isPeerReview
        ? `Peer review recorded for ${student.name}`
        : "Skill verified successfully",
      verifierRole,
    });
  } catch (err) {
    console.error("verification error:", err);
    res.status(500).json({ error: "Server error during verification" });
  }
});

/* =================================== GET /api/verifications/:studentId/score */
router.get("/:studentId/score", authenticateToken, async (req, res) => {
  try {
    const verifs = await prisma.skillVerification.findMany({
      where: { studentId: req.params.studentId },
      select: { verifierRole: true, confidence: true },
    });

    const weightedTokens = verifs.reduce((a, v) => {
      const w = ROLE_WEIGHT[v.verifierRole] || 0.5;
      const c = v.confidence === 1 ? 1 : 0.5;
      return a + w * c * STUDENT_TOKENS_PER_SKILL;
    }, 0);

    const reputation = Math.min(100, Math.round((weightedTokens / 1550) * 100));
    const vStatus = verifs.length
      ? Math.round(
          (verifs.reduce((a, v) => {
            const w = ROLE_WEIGHT[v.verifierRole] || 0.5;
            const c = v.confidence === 1 ? 1 : 0.5;
            return a + w * c;
          }, 0) /
            verifs.length) *
            100
        )
      : 0;
    const composite = Math.round(Math.sqrt(reputation * vStatus));

    res.json({ reputation, vStatus, composite, totalVerifications: verifs.length });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

/* ============================= GET /api/verifications/peer/candidates ===== */
/** Students this user may evaluate as a peer.
 *
 *  Excludes: themselves, inactive accounts, and anyone they have already
 *  evaluated (so the UI never offers a duplicate). Supports search by name or
 *  email, which is what makes this usable once there are more than a handful
 *  of students. */
router.get("/peer/candidates", authenticateToken, async (req, res) => {
  if (req.user.role !== "Student")
    return res.status(403).json({ error: "Peer evaluation is available to students only" });

  try {
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { peerVerifierEnabled: true },
    });
    if (me?.peerVerifierEnabled === false)
      return res.status(403).json({
        error: "Your peer-review privilege has been disabled by an administrator",
        disabled: true,
      });

    const limit = await getPeerMaxStudents();
    if (limit === 0)
      return res.status(403).json({
        error: "Peer review is currently disabled by the administrator.",
        peerDisabled: true,
      });

    const search = (req.query.search || "").trim();
    const take = Math.min(Math.max(parseInt(req.query.take, 10) || 20, 1), 50);

    // Everyone this student has already evaluated.
    const scored = await prisma.skillVerification.findMany({
      where: { verifierId: req.user.id },
      select: { studentId: true, skillName: true, createdAt: true },
    });
    const scoredIds = [...new Set(scored.map((v) => v.studentId))];

    const quotaReached = limit !== null && scoredIds.length >= limit;

    const where = {
      role: "Student",
      isActive: true,
      id: { notIn: [req.user.id, ...scoredIds] },   // never self, never a repeat
    };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    // If the quota is used up there is nothing left to offer, but the UI still
    // wants the list of who was already evaluated.
    const candidates = quotaReached
      ? []
      : await prisma.user.findMany({
          where,
          take,
          orderBy: { name: "asc" },
          select: { id: true, name: true, email: true, profileText: true, createdAt: true },
        });

    const alreadyEvaluated = scoredIds.length
      ? await prisma.user.findMany({
          where: { id: { in: scoredIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

    res.json({
      candidates,
      alreadyEvaluated: alreadyEvaluated.map((u) => ({
        ...u,
        skills: scored.filter((v) => v.studentId === u.id).map((v) => v.skillName),
      })),
      quota: {
        limit,
        used: scoredIds.length,
        remaining: limit === null ? null : Math.max(0, limit - scoredIds.length),
        reached: quotaReached,
      },
    });
  } catch (err) {
    console.error("peer/candidates error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
