const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { authenticateToken } = require("../middleware/keycloakAuth");

// GET /api/tokens/balance
router.get("/balance", authenticateToken, async (req, res) => {
  try {
    const wallet = await prisma.tokenWallet.findUnique({ where: { userId: req.user.id } });
    res.json({ balance: wallet?.balance ?? 0 });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/tokens/ledger
router.get("/ledger", authenticateToken, async (req, res) => {
  try {
    const entries = await prisma.tokenLedger.findMany({
      where: {
        OR: [{ fromUserId: req.user.id }, { toUserId: req.user.id }],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        fromUser: { select: { name: true } },
        toUser: { select: { name: true } },
      },
    });
    res.json(
      entries.map((e) => ({
        id: e.id,
        kind: e.kind,
        amount: e.amount,
        from_label: e.fromLabel,
        to_label: e.toLabel,
        note: e.note,
        created_at: e.createdAt,
        from_name: e.fromUser?.name ?? null,
        to_name: e.toUser?.name ?? null,
      }))
    );
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/tokens/award — professor awards tokens to a student
router.post("/award", authenticateToken, async (req, res) => {
  if (req.user.role !== "Professor")
    return res.status(403).json({ error: "Only professors can award tokens" });

  const { student_id, amount } = req.body;
  const amt = Number(amount);
  if (!student_id || !amt || amt <= 0)
    return res.status(400).json({ error: "student_id and a positive amount are required" });

  try {
    const [profWallet, student] = await Promise.all([
      prisma.tokenWallet.findUnique({ where: { userId: req.user.id } }),
      prisma.user.findFirst({ where: { id: student_id, role: "Student" }, select: { id: true, name: true } }),
    ]);

    if (!profWallet || profWallet.balance < amt)
      return res.status(400).json({ error: "Insufficient professor balance" });
    if (!student)
      return res.status(404).json({ error: "Student not found" });

    const updatedWallet = await prisma.$transaction(async (tx) => {
      await tx.tokenWallet.update({
        where: { userId: req.user.id },
        data: { balance: { decrement: amt } },
      });
      await tx.tokenWallet.upsert({
        where: { userId: student_id },
        update: { balance: { increment: amt } },
        create: { userId: student_id, balance: amt },
      });
      await tx.tokenLedger.create({
        data: {
          kind: "award",
          amount: amt,
          fromUserId: req.user.id,
          toUserId: student_id,
          fromLabel: "Professor",
          toLabel: "Student",
          note: "Professor awarded tokens to student",
        },
      });
      return tx.tokenWallet.findUnique({ where: { userId: req.user.id } });
    });

    res.json({ success: true, new_professor_balance: updatedWallet.balance });
  } catch (err) {
    console.error("award error:", err);
    res.status(500).json({ error: "Server error during token award" });
  }
});

module.exports = router;
