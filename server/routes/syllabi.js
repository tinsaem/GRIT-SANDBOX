const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { authenticateToken } = require("../middleware/keycloakAuth");

const PROFESSOR_TOKENS_PER_SYLLABUS = 900;

// GET /api/syllabi
router.get("/", authenticateToken, async (req, res) => {
  try {
    let syllabi;

    if (req.user.role === "Student") {
      syllabi = await prisma.syllabus.findMany({
        where: { studentId: req.user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, title: true, status: true, createdAt: true,
          professor: { select: { name: true } },
          advisor: { select: { name: true } },
        },
      });
      syllabi = syllabi.map((s) => ({
        id: s.id, title: s.title, status: s.status, created_at: s.createdAt,
        professor_name: s.professor?.name ?? null,
        advisor_name: s.advisor?.name ?? null,
      }));
    } else if (req.user.role === "Professor") {
      // Professors see the open queue (unclaimed requests) plus whatever they already supervise.
      syllabi = await prisma.syllabus.findMany({
        where: { OR: [{ status: "pending" }, { professorId: req.user.id }] },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, title: true, status: true, createdAt: true, content: true,
          student: { select: { name: true } },
          professorId: true,
        },
      });
      syllabi = syllabi.map((s) => ({
        id: s.id, title: s.title, status: s.status, created_at: s.createdAt, content: s.content,
        student_name: s.student?.name ?? null,
        mine: s.professorId === req.user.id,
      }));
    } else {
      syllabi = await prisma.syllabus.findMany({
        where: { advisorId: req.user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, title: true, status: true, createdAt: true,
          student: { select: { name: true } },
        },
      });
      syllabi = syllabi.map((s) => ({
        id: s.id, title: s.title, status: s.status, created_at: s.createdAt,
        student_name: s.student?.name ?? null,
      }));
    }

    res.json(syllabi);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/syllabi/:id
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const syl = await prisma.syllabus.findUnique({ where: { id: req.params.id } });
    if (!syl) return res.status(404).json({ error: "Syllabus not found" });

    const isParticipant =
      syl.studentId === req.user.id || syl.advisorId === req.user.id || syl.professorId === req.user.id;
    const isProfessorOnPending = req.user.role === "Professor" && syl.status === "pending";
    if (!isParticipant && !isProfessorOnPending)
      return res.status(403).json({ error: "You cannot view this syllabus" });

    res.json({
      ...syl,
      student_id: syl.studentId,
      advisor_id: syl.advisorId,
      professor_id: syl.professorId,
      created_at: syl.createdAt,
      updated_at: syl.updatedAt,
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/syllabi — only students (for themselves) and advisors (for a student)
router.post("/", authenticateToken, async (req, res) => {
  const { title, content, student_id } = req.body;
  if (!title || !content) return res.status(400).json({ error: "title and content required" });

  if (req.user.role !== "Student" && req.user.role !== "Advisor")
    return res.status(403).json({ error: "Only students and advisors can submit directed-study requests" });

  const sid = req.user.role === "Student" ? req.user.id : student_id;
  const aid = req.user.role === "Advisor" ? req.user.id : null;
  const parsedContent = typeof content === "string" ? JSON.parse(content) : content;

  try {
    if (req.user.role === "Advisor") {
      if (!sid) return res.status(400).json({ error: "student_id is required" });
      const student = await prisma.user.findFirst({ where: { id: sid, role: "Student" }, select: { id: true } });
      if (!student) return res.status(404).json({ error: "Student not found" });
    }
    const syl = await prisma.syllabus.create({
      data: { studentId: sid, advisorId: aid, title: title.trim(), content: parsedContent },
      select: { id: true },
    });
    res.status(201).json({ id: syl.id });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/syllabi/:id — edit title/content (creator while pending, or the assigned professor)
router.put("/:id", authenticateToken, async (req, res) => {
  const { title, content } = req.body;
  try {
    const syl = await prisma.syllabus.findUnique({
      where: { id: req.params.id },
      select: { studentId: true, advisorId: true, professorId: true, status: true },
    });
    if (!syl) return res.status(404).json({ error: "Syllabus not found" });

    const isCreator = syl.studentId === req.user.id || syl.advisorId === req.user.id;
    const isAssignedProfessor = syl.professorId === req.user.id;
    const isAnyProfessorOnPending = req.user.role === "Professor" && syl.status === "pending";
    if (!isAssignedProfessor && !isAnyProfessorOnPending && !(isCreator && syl.status === "pending"))
      return res.status(403).json({ error: "You cannot edit this syllabus" });

    const parsedContent = content !== undefined
      ? (typeof content === "string" ? JSON.parse(content) : content)
      : undefined;

    await prisma.syllabus.update({
      where: { id: req.params.id },
      data: {
        ...(title ? { title: title.trim() } : {}),
        ...(parsedContent !== undefined ? { content: parsedContent } : {}),
      },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("syllabus edit error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/syllabi/:id/supervise
router.post("/:id/supervise", authenticateToken, async (req, res) => {
  if (req.user.role !== "Professor")
    return res.status(403).json({ error: "Only professors can supervise syllabi" });

  try {
    const syl = await prisma.syllabus.findUnique({
      where: { id: req.params.id },
      select: { id: true, studentId: true, status: true },
    });
    if (!syl) return res.status(404).json({ error: "Syllabus not found" });
    if (syl.status === "supervised") return res.status(409).json({ error: "Already supervised" });

    const existing = await prisma.supervision.findUnique({
      where: { professorId_syllabusId: { professorId: req.user.id, syllabusId: req.params.id } },
    });
    if (existing) return res.status(409).json({ error: "You have already agreed to supervise this syllabus" });

    const updatedWallet = await prisma.$transaction(async (tx) => {
      await tx.supervision.create({
        data: {
          professorId: req.user.id,
          studentId: syl.studentId,
          syllabusId: req.params.id,
          tokensAwarded: PROFESSOR_TOKENS_PER_SYLLABUS,
        },
      });
      await tx.syllabus.update({
        where: { id: req.params.id },
        data: { professorId: req.user.id, status: "supervised" },
      });
      await tx.tokenWallet.upsert({
        where: { userId: req.user.id },
        update: { balance: { increment: PROFESSOR_TOKENS_PER_SYLLABUS } },
        create: { userId: req.user.id, balance: PROFESSOR_TOKENS_PER_SYLLABUS },
      });
      await tx.tokenLedger.create({
        data: {
          kind: "supervise",
          amount: PROFESSOR_TOKENS_PER_SYLLABUS,
          toUserId: req.user.id,
          toLabel: "Professor",
          note: "Agreed to supervise syllabus",
        },
      });
      return tx.tokenWallet.findUnique({ where: { userId: req.user.id } });
    });

    res.json({ success: true, new_professor_balance: updatedWallet.balance });
  } catch (err) {
    console.error("supervise error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
