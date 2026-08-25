const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const prisma = require("../prisma/client");
const { authenticateToken, requireRole } = require("../middleware/keycloakAuth");
const { getAllSettings, setSetting, DESCRIPTIONS } = require("../services/settings");
const { sendVerificationEmail } = require("../email");

const router = express.Router();

/* =============================================================================
   Admin / User-Management API
   -----------------------------------------------------------------------------
   Every route here is gated twice: a valid JWT (authenticateToken) AND the
   Admin role (requireRole). Mounted in index.js at /api/admin.

   Safety invariants enforced below — these are deliberate and should not be
   relaxed without thought:
     1. An admin can never deactivate or delete their own account.
     2. The last remaining active admin can never be deactivated or deleted,
        so the system cannot be locked out of its own administration.
     3. Every mutation writes an AuditLog row.
   ========================================================================== */

// Peer removed: it is a Student capability (peerVerifierEnabled), not a role.
const ASSIGNABLE_ROLES = ["Student", "Professor", "Advisor", "Employer", "Admin"];
const WALLET_START = { Student: 500, Professor: 5000, Advisor: 5000, Employer: 5000, Admin: 0 };

// Columns safe to return to the client — never passwordHash or raw tokens.
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  emailVerified: true,
  isActive: true,
  peerVerifierEnabled: true,
  lastLoginAt: true,
  deactivatedAt: true,
  deactivatedReason: true,
  createdAt: true,
  updatedAt: true,
  profileText: true,
  hederaAddress: true,
  wallet: { select: { balance: true } },
};

/* ------------------------------------------------------------------ helpers */

async function writeAudit(req, { action, targetType, targetId, targetName, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id || null,
        actorName: req.user?.name || req.user?.email || "unknown",
        actorRole: req.user?.role || null,
        action,
        targetType: targetType || null,
        targetId: targetId || null,
        targetName: targetName || null,
        details: details ? String(details).slice(0, 1000) : null,
        ipAddress: (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").toString().slice(0, 80),
      },
    });
  } catch (err) {
    // Audit failure must never break the operation the admin asked for.
    console.error("audit write failed:", err.message);
  }
}

async function countActiveAdmins(excludeId) {
  return prisma.user.count({
    where: { role: "Admin", isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
}

/** Blocks the two lockout scenarios. Returns an error string, or null if allowed. */
async function guardDestructive(req, targetId, verb) {
  if (targetId === req.user.id) {
    return `You cannot ${verb} your own account.`;
  }
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true, isActive: true } });
  if (!target) return "User not found.";
  if (target.role === "Admin" && target.isActive) {
    const remaining = await countActiveAdmins(targetId);
    if (remaining < 1) {
      return `Cannot ${verb} the last active administrator — the system would be left with no admin access.`;
    }
  }
  return null;
}

// Every route below requires a logged-in Admin.
router.use(authenticateToken, requireRole("Admin"));

/* ============================================================== GET /stats */
/** Dashboard overview: totals, role split, growth series, activity metrics. */
router.get("/stats", async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 365);
    const since = new Date(Date.now() - days * 86400000);

    const [
      totalUsers,
      activeUsers,
      verifiedUsers,
      byRoleRaw,
      recentUsers,
      newInPeriod,
      totalTokens,
      verificationCount,
      syllabusCount,
      companyCount,
      messageCount,
      growthRows,
      loginRows,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.user.groupBy({ by: ["role"], _count: { role: true } }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      }),
      prisma.user.count({ where: { createdAt: { gte: since } } }),
      prisma.tokenWallet.aggregate({ _sum: { balance: true } }),
      prisma.skillVerification.count().catch(() => 0),
      prisma.syllabus.count().catch(() => 0),
      prisma.company.count().catch(() => 0),
      prisma.message.count().catch(() => 0),
      prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, role: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.user.count({ where: { lastLoginAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
    ]);

    // Normalise role counts so every role appears even at zero.
    const byRole = ASSIGNABLE_ROLES.map((role) => ({
      role,
      count: byRoleRaw.find((r) => r.role === role)?._count.role || 0,
    }));

    // Bucket signups per day into a dense series (no gaps) for the growth chart.
    const buckets = new Map();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    growthRows.forEach((row) => {
      const key = row.createdAt.toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1);
    });
    const growth = [...buckets.entries()].map(([date, count]) => ({ date, count }));

    // Running cumulative total for the area chart.
    let running = totalUsers - newInPeriod;
    const cumulative = growth.map((g) => {
      running += g.count;
      return { date: g.date, total: running };
    });

    res.json({
      totals: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        verifiedUsers,
        unverifiedUsers: totalUsers - verifiedUsers,
        newInPeriod,
        activeLast7Days: loginRows,
        totalTokens: totalTokens._sum.balance || 0,
        verificationCount,
        syllabusCount,
        companyCount,
        messageCount,
      },
      byRole,
      growth,
      cumulative,
      recentUsers,
      periodDays: days,
    });
  } catch (err) {
    console.error("admin/stats error:", err);
    res.status(500).json({ error: "Failed to load statistics" });
  }
});

/* ============================================================== GET /users */
/** Paged, searchable, filterable user list. */
router.get("/users", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 5), 500);
    const { search = "", role = "", status = "", verified = "", sortBy = "createdAt", sortDir = "desc" } = req.query;

    const where = {};
    if (search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { email: { contains: search.trim(), mode: "insensitive" } },
      ];
    }
    if (role && ASSIGNABLE_ROLES.includes(role)) where.role = role;
    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;
    if (verified === "yes") where.emailVerified = true;
    if (verified === "no") where.emailVerified = false;

    const allowedSort = ["createdAt", "name", "email", "role", "lastLoginAt"];
    const orderBy = { [allowedSort.includes(sortBy) ? sortBy : "createdAt"]: sortDir === "asc" ? "asc" : "desc" };

    const [rows, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, select: USER_SELECT }),
      prisma.user.count({ where }),
    ]);

    res.json({ users: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 });
  } catch (err) {
    console.error("admin/users list error:", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

/* ============================================================= POST /users */
/** Admin-created accounts are pre-verified — this is the intended way to
 *  onboard users while SMTP credentials are not configured. */
router.post("/users", async (req, res) => {
  const { name, email, password, role, emailVerified = true, isActive = true } = req.body;

  if (!name || !email || !password || !role)
    return res.status(400).json({ error: "name, email, password and role are all required" });
  if (!ASSIGNABLE_ROLES.includes(role))
    return res.status(400).json({ error: "Invalid role. Must be one of: " + ASSIGNABLE_ROLES.join(", ") });
  if (password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters" });

  try {
    const cleanEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) return res.status(409).json({ error: "An account with this email already exists" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        role,
        emailVerified: Boolean(emailVerified),
        isActive: Boolean(isActive),
      },
      select: USER_SELECT,
    });

    // Mirror signup: give the new account its starting wallet.
    await prisma.tokenWallet.create({
      data: { userId: user.id, balance: WALLET_START[role] ?? 0 },
    }).catch(() => {});

    await writeAudit(req, {
      action: "user.create",
      targetType: "User",
      targetId: user.id,
      targetName: user.email,
      details: `Created ${role} account (verified=${emailVerified}, active=${isActive})`,
    });

    res.status(201).json({ message: "User created", user });
  } catch (err) {
    console.error("admin/users create error:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

/* ========================================================= PATCH /users/:id */
router.patch("/users/:id", async (req, res) => {
  const { id } = req.params;
  const { name, email, role, emailVerified, peerVerifierEnabled } = req.body;

  try {
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, email: true, isActive: true } });
    if (!target) return res.status(404).json({ error: "User not found" });

    // Demoting an admin is a lockout risk — same guard as deletion.
    if (role && role !== target.role && target.role === "Admin") {
      const blocked = await guardDestructive(req, id, "demote");
      if (blocked) return res.status(400).json({ error: blocked });
    }
    if (role && !ASSIGNABLE_ROLES.includes(role))
      return res.status(400).json({ error: "Invalid role" });

    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (email !== undefined) data.email = String(email).toLowerCase().trim();
    if (role !== undefined) data.role = role;
    if (emailVerified !== undefined) data.emailVerified = Boolean(emailVerified);
    // Peer-review privilege — only meaningful for Students.
    if (peerVerifierEnabled !== undefined) data.peerVerifierEnabled = Boolean(peerVerifierEnabled);

    if (!Object.keys(data).length) return res.status(400).json({ error: "Nothing to update" });

    const user = await prisma.user.update({ where: { id }, data, select: USER_SELECT });

    await writeAudit(req, {
      action: "user.update",
      targetType: "User",
      targetId: id,
      targetName: user.email,
      details: Object.entries(data).map(([k, v]) => `${k}=${v}`).join(", "),
    });

    res.json({ message: "User updated", user });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "That email is already in use" });
    console.error("admin/users update error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

/* ================================================== PATCH /users/:id/status */
/** Activate / deactivate. Deactivation is the reversible alternative to
 *  deletion and is what the UI recommends by default. */
router.patch("/users/:id/status", async (req, res) => {
  const { id } = req.params;
  const { isActive, reason } = req.body;

  if (typeof isActive !== "boolean")
    return res.status(400).json({ error: "isActive must be true or false" });

  try {
    if (!isActive) {
      const blocked = await guardDestructive(req, id, "deactivate");
      if (blocked) return res.status(400).json({ error: blocked });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        isActive,
        deactivatedAt: isActive ? null : new Date(),
        deactivatedReason: isActive ? null : (reason ? String(reason).slice(0, 500) : null),
      },
      select: USER_SELECT,
    });

    await writeAudit(req, {
      action: isActive ? "user.activate" : "user.deactivate",
      targetType: "User",
      targetId: id,
      targetName: user.email,
      details: reason || null,
    });

    res.json({ message: isActive ? "User activated" : "User deactivated", user });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "User not found" });
    console.error("admin/users status error:", err);
    res.status(500).json({ error: "Failed to change user status" });
  }
});

/* ================================================= POST /users/:id/verify */
/** Manually mark a user's email as verified — useful when SMTP is down. */
router.post("/users/:id/verify", async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.update({
      where: { id },
      data: { emailVerified: true, verificationToken: null, verificationTokenExpires: null },
      select: USER_SELECT,
    });

    await writeAudit(req, {
      action: "user.verify",
      targetType: "User",
      targetId: id,
      targetName: user.email,
      details: "Email manually verified by administrator",
    });

    res.json({ message: "User verified", user });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "User not found" });
    console.error("admin/users verify error:", err);
    res.status(500).json({ error: "Failed to verify user" });
  }
});

/* ================================= POST /users/:id/resend-verification */
/** Generate a fresh OTP and re-send the verification email for any unverified
 *  account. Useful when SMTP was misconfigured at signup time, or the original
 *  email landed in spam. Idempotent: calling it again just replaces the token. */
router.post("/users/:id/resend-verification", async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, emailVerified: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.emailVerified)
      return res.status(400).json({ error: "This account is already verified" });

    const otp = String(crypto.randomInt(100000, 1000000));
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.user.update({
      where: { id },
      data: { verificationToken: otp, verificationTokenExpires: expires },
    });

    await sendVerificationEmail(user.email, user.name, otp);

    await writeAudit(req, {
      action: "user.resend_verification",
      targetType: "User",
      targetId: id,
      targetName: user.email,
      details: "Admin resent verification email",
    });

    res.json({ message: "Verification email resent" });
  } catch (err) {
    console.error("admin/resend-verification error:", err);
    res.status(500).json({ error: "Failed to resend verification email" });
  }
});

/* ========================================== POST /users/:id/reset-password */
router.post("/users/:id/reset-password", async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters" });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.update({
      where: { id },
      data: { passwordHash, resetToken: null, resetTokenExpires: null },
      select: { id: true, email: true },
    });

    await writeAudit(req, {
      action: "user.password_reset",
      targetType: "User",
      targetId: id,
      targetName: user.email,
      details: "Password set by administrator",
    });

    res.json({ message: "Password updated" });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "User not found" });
    console.error("admin/reset-password error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

/* ======================================================== DELETE /users/:id */
/** Hard delete. Related rows cascade per the schema's onDelete rules. */
router.delete("/users/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const blocked = await guardDestructive(req, id, "delete");
    if (blocked) return res.status(400).json({ error: blocked });

    const target = await prisma.user.findUnique({ where: { id }, select: { email: true, name: true, role: true } });
    if (!target) return res.status(404).json({ error: "User not found" });

    await prisma.user.delete({ where: { id } });

    await writeAudit(req, {
      action: "user.delete",
      targetType: "User",
      targetId: id,
      targetName: target.email || target.name,
      details: `Permanently deleted ${target.role} account`,
    });

    res.json({ message: "User deleted permanently" });
  } catch (err) {
    console.error("admin/users delete error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

/* ======================================================== POST /users/bulk */
/** Bulk activate / deactivate / delete. Per-row guards still apply, and
 *  blocked rows are reported back rather than failing the whole batch. */
router.post("/users/bulk", async (req, res) => {
  const { ids, action, reason } = req.body;

  if (!Array.isArray(ids) || !ids.length)
    return res.status(400).json({ error: "ids must be a non-empty array" });
  if (!["activate", "deactivate", "delete"].includes(action))
    return res.status(400).json({ error: "action must be activate, deactivate or delete" });

  const succeeded = [];
  const skipped = [];

  for (const id of ids) {
    try {
      if (action !== "activate") {
        const blocked = await guardDestructive(req, id, action);
        if (blocked) { skipped.push({ id, reason: blocked }); continue; }
      }
      if (action === "delete") {
        await prisma.user.delete({ where: { id } });
      } else {
        await prisma.user.update({
          where: { id },
          data: {
            isActive: action === "activate",
            deactivatedAt: action === "activate" ? null : new Date(),
            deactivatedReason: action === "activate" ? null : (reason || null),
          },
        });
      }
      succeeded.push(id);
    } catch (err) {
      skipped.push({ id, reason: err.code === "P2025" ? "User not found" : "Operation failed" });
    }
  }

  await writeAudit(req, {
    action: `user.bulk_${action}`,
    targetType: "User",
    details: `${succeeded.length} succeeded, ${skipped.length} skipped`,
  });

  res.json({ message: `Bulk ${action} complete`, succeeded: succeeded.length, skipped });
});

/* ============================================================== GET /audit */
router.get("/audit", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 50, 5), 200);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count(),
    ]);

    res.json({ logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 });
  } catch (err) {
    console.error("admin/audit error:", err);
    res.status(500).json({ error: "Failed to load audit log" });
  }
});

/* ============================================================= GET /export */
/** Returns every user (respecting filters) unpaged, for client-side
 *  CSV / Excel / PDF generation. */
router.get("/export", async (req, res) => {
  try {
    const { role = "", status = "" } = req.query;
    const where = {};
    if (role && ASSIGNABLE_ROLES.includes(role)) where.role = role;
    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: USER_SELECT,
    });

    await writeAudit(req, {
      action: "data.export",
      targetType: "User",
      details: `Exported ${users.length} user records`,
    });

    res.json({ users, exportedAt: new Date().toISOString(), count: users.length });
  } catch (err) {
    console.error("admin/export error:", err);
    res.status(500).json({ error: "Failed to export users" });
  }
});

/* ========================================================== GET /settings */
/** Runtime platform settings, editable below. */
router.get("/settings", async (req, res) => {
  try {
    res.json({ settings: await getAllSettings() });
  } catch (err) {
    console.error("admin/settings get error:", err);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

/* ======================================================== PATCH /settings */
/** Update one setting. Validated per key — a bad peer limit would silently
 *  break peer review, so it is range-checked here rather than trusted. */
router.patch("/settings/:key", async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  const allowed = Object.keys(DESCRIPTIONS);
  if (!allowed.includes(key))
    return res.status(400).json({ error: `Unknown setting. Allowed: ${allowed.join(", ")}` });

  if (key === "peer_max_students") {
    const n = parseInt(value, 10);
    if (Number.isNaN(n) || n < -1 || n > 100)
      return res.status(400).json({
        error: "Peer limit must be a whole number between -1 and 100. Use 0 to disable peer review, or -1 for unlimited.",
      });
  }

  try {
    const row = await setSetting(key, value, req.user.name || req.user.email);

    await writeAudit(req, {
      action: "settings.update",
      targetType: "PlatformSetting",
      targetId: key,
      targetName: key,
      details: `Set to "${value}"`,
    });

    res.json({ message: "Setting updated", setting: row });
  } catch (err) {
    console.error("admin/settings patch error:", err);
    res.status(500).json({ error: "Failed to update setting" });
  }
});

/* ============================================== GET /peer-review-overview */
/** Who has used their peer-review allowance, and who has not. Lets an admin
 *  see participation without digging through the verifications table. */
router.get("/peer-review-overview", async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: "Student", isActive: true },
      select: { id: true, name: true, email: true, peerVerifierEnabled: true },
      orderBy: { name: "asc" },
    });

    const given = await prisma.skillVerification.findMany({
      where: { verifierRole: "Peer" },
      select: { verifierId: true, studentId: true },
    });

    const byVerifier = new Map();
    for (const g of given) {
      if (!byVerifier.has(g.verifierId)) byVerifier.set(g.verifierId, new Set());
      byVerifier.get(g.verifierId).add(g.studentId);
    }

    res.json({
      students: students.map((s) => ({
        ...s,
        studentsEvaluated: byVerifier.get(s.id)?.size || 0,
      })),
      totalPeerReviews: given.length,
    });
  } catch (err) {
    console.error("admin/peer-review-overview error:", err);
    res.status(500).json({ error: "Failed to load peer review overview" });
  }
});

module.exports = router;
