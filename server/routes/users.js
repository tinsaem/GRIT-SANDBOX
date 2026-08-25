const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { authenticateToken, requireRole } = require("../middleware/keycloakAuth");

function formatUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    hedera_address: u.hederaAddress ?? null,
    profile_text: u.profileText ?? null,
    email_verified: u.emailVerified,
    created_at: u.createdAt,
    token_balance: u.wallet?.balance ?? 0,
  };
}

// GET /api/users/profile
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { wallet: { select: { balance: true } } },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(formatUser(user));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/users/profile
router.put("/profile", authenticateToken, async (req, res) => {
  const { name, hedera_address, profile_text } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name.trim(),
        hederaAddress: hedera_address?.trim() || null,
        profileText: profile_text?.trim() || null,
      },
      select: {
        id: true, name: true, email: true, role: true,
        hederaAddress: true, profileText: true,
      },
    });
    res.json({
      id: user.id, name: user.name, email: user.email, role: user.role,
      hedera_address: user.hederaAddress, profile_text: user.profileText,
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users/students
router.get("/students", authenticateToken, async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: "Student" },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, role: true, hederaAddress: true,
        wallet: { select: { balance: true } },
      },
    });
    res.json(
      students.map((s) => ({
        id: s.id, name: s.name, role: s.role,
        hedera_address: s.hederaAddress,
        token_balance: s.wallet?.balance ?? 0,
      }))
    );
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users/:id/public
router.get("/:id/public", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, role: true, hederaAddress: true, profileText: true,
        wallet: { select: { balance: true } },
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
      id: user.id, name: user.name, role: user.role,
      hedera_address: user.hederaAddress, profile_text: user.profileText,
      token_balance: user.wallet?.balance ?? 0,
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users/resume
router.get("/resume", authenticateToken, async (req, res) => {
  try {
    const resume = await prisma.resume.findFirst({
      where: { userId: req.user.id, isCurrent: true },
      orderBy: { createdAt: "desc" },
      select: { content: true },
    });
    res.json({ content: resume?.content || "" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/users/resume
router.post("/resume", authenticateToken, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "Resume content required" });
  try {
    await prisma.resume.updateMany({
      where: { userId: req.user.id },
      data: { isCurrent: false },
    });
    const resume = await prisma.resume.create({
      data: { userId: req.user.id, content },
      select: { id: true, createdAt: true },
    });
    res.json(resume);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users/jd
router.get("/jd", authenticateToken, async (req, res) => {
  try {
    const jd = await prisma.jobDescription.findFirst({
      where: { userId: req.user.id, isCurrent: true },
      orderBy: { createdAt: "desc" },
      select: { content: true, targetCompany: true },
    });
    res.json({ content: jd?.content || "", target_company: jd?.targetCompany || "" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users/:id/resume — a verifier/advisor viewing a specific student's résumé
router.get("/:id/resume", authenticateToken, requireRole("Professor", "Advisor", "Employer", "Student"), async (req, res) => {
  try {
    const student = await prisma.user.findFirst({ where: { id: req.params.id, role: "Student" }, select: { id: true } });
    if (!student) return res.status(404).json({ error: "Student not found" });
    const resume = await prisma.resume.findFirst({
      where: { userId: req.params.id, isCurrent: true },
      orderBy: { createdAt: "desc" },
      select: { content: true },
    });
    res.json({ content: resume?.content || "" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users/:id/jd — a verifier/advisor viewing a specific student's desired JD
router.get("/:id/jd", authenticateToken, // Students included: peer reviewers need to read a peer's JD.
  requireRole("Professor", "Advisor", "Employer", "Student"), async (req, res) => {
  try {
    const student = await prisma.user.findFirst({ where: { id: req.params.id, role: "Student" }, select: { id: true } });
    if (!student) return res.status(404).json({ error: "Student not found" });
    const jd = await prisma.jobDescription.findFirst({
      where: { userId: req.params.id, isCurrent: true },
      orderBy: { createdAt: "desc" },
      select: { content: true, targetCompany: true },
    });
    res.json({ content: jd?.content || "", target_company: jd?.targetCompany || "" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/users/jd
router.post("/jd", authenticateToken, async (req, res) => {
  const { content, target_company } = req.body;
  if (!content) return res.status(400).json({ error: "JD content required" });
  try {
    await prisma.jobDescription.updateMany({
      where: { userId: req.user.id },
      data: { isCurrent: false },
    });
    const jd = await prisma.jobDescription.create({
      data: { userId: req.user.id, content, targetCompany: target_company || null },
      select: { id: true },
    });
    res.json(jd);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
