const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { authenticateToken } = require("../middleware/keycloakAuth");

const ROLE_WEIGHT = { Employer: 1.0, Professor: 0.8, Advisor: 0.7, Peer: 0.5, Student: 0.5 };
const STUDENT_TOKENS_PER_SKILL = 100;

// GET /api/leaderboard — top 50 students by composite score
router.get("/", authenticateToken, async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: "Student" },
      select: {
        id: true,
        name: true,
        wallet: { select: { balance: true } },
        verificationsAsStudent: { select: { verifierRole: true, confidence: true } },
      },
    });

    const rows = students.map((s) => {
      const vs = s.verificationsAsStudent;
      const weightedTokens = vs.reduce((a, v) => {
        const w = ROLE_WEIGHT[v.verifierRole] || 0.5;
        return a + w * (v.confidence === 1 ? 1 : 0.5) * STUDENT_TOKENS_PER_SKILL;
      }, 0);
      const reputation = Math.min(100, Math.round((weightedTokens / 1550) * 100));
      const vStatus = vs.length
        ? Math.round(
            (vs.reduce((a, v) => {
              const w = ROLE_WEIGHT[v.verifierRole] || 0.5;
              return a + w * (v.confidence === 1 ? 1 : 0.5);
            }, 0) /
              vs.length) *
              100
          )
        : 0;
      const composite = Math.round(Math.sqrt(reputation * vStatus));
      return {
        id: s.id,
        name: s.name,
        score: composite,
        reputation,
        vStatus,
        token_balance: s.wallet?.balance ?? 0,
      };
    });

    rows.sort((a, b) => b.score - a.score);
    res.json(rows.slice(0, 50));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
