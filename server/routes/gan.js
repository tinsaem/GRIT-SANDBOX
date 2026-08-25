const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { authenticateToken, requireRole } = require("../middleware/keycloakAuth");

// GET /api/gan
router.get("/", authenticateToken, async (req, res) => {
  try {
    const sessions = await prisma.ganSession.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, sector: true, loopsRun: true, meanCoverage: true,
        equilibriumReached: true, createdAt: true, updatedAt: true,
      },
    });
    res.json(
      sessions.map((s) => ({
        id: s.id,
        sector: s.sector,
        loops_run: s.loopsRun,
        mean_coverage: s.meanCoverage ? Number(s.meanCoverage) : null,
        equilibrium_reached: s.equilibriumReached,
        created_at: s.createdAt,
        updated_at: s.updatedAt,
      }))
    );
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/gan/latest
router.get("/latest", authenticateToken, async (req, res) => {
  try {
    const session = await prisma.ganSession.findFirst({
      where: { userId: req.user.id },
      orderBy: { updatedAt: "desc" },
    });
    if (!session) return res.json(null);
    res.json({
      id: session.id,
      sector: session.sector,
      loops_run: session.loopsRun,
      mean_coverage: session.meanCoverage ? Number(session.meanCoverage) : null,
      modules: session.modules,
      equilibrium_reached: session.equilibriumReached,
      recommendation_text: session.recommendationText,
      guideline_text: session.guidelineText,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/gan — create or update a GAN session
router.post("/", authenticateToken, requireRole("Professor", "Advisor"), async (req, res) => {
  const { sector, loops_run, mean_coverage, modules, equilibrium_reached, recommendation_text, guideline_text } =
    req.body;
  if (!sector) return res.status(400).json({ error: "sector required" });

  try {
    const existing = await prisma.ganSession.findFirst({
      where: { userId: req.user.id, sector, equilibriumReached: false },
      select: { id: true },
    });

    let session;
    if (existing) {
      session = await prisma.ganSession.update({
        where: { id: existing.id },
        data: {
          loopsRun: loops_run || 0,
          meanCoverage: mean_coverage ?? null,
          modules: modules || null,
          equilibriumReached: equilibrium_reached || false,
          recommendationText: recommendation_text || null,
          guidelineText: guideline_text || null,
        },
        select: { id: true },
      });
    } else {
      session = await prisma.ganSession.create({
        data: {
          userId: req.user.id,
          sector,
          loopsRun: loops_run || 0,
          meanCoverage: mean_coverage ?? null,
          modules: modules || null,
          equilibriumReached: equilibrium_reached || false,
          recommendationText: recommendation_text || null,
          guidelineText: guideline_text || null,
        },
        select: { id: true },
      });
    }

    res.status(201).json({ id: session.id });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
