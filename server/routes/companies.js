const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { authenticateToken } = require("../middleware/keycloakAuth");

// GET /api/companies
router.get("/", authenticateToken, async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      where: { createdBy: req.user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, profile: true, sector: true, locked: true, createdAt: true },
    });
    res.json(companies.map((c) => ({ ...c, created_at: c.createdAt })));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/companies/:id
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        useCases: {
          orderBy: { useCaseId: "asc" },
          select: { useCaseId: true, description: true },
        },
      },
    });
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json({
      ...company,
      created_by: company.createdBy,
      created_at: company.createdAt,
      updated_at: company.updatedAt,
      use_cases: company.useCases.map((u) => ({ use_case_id: u.useCaseId, description: u.description })),
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/companies
router.post("/", authenticateToken, async (req, res) => {
  const { name, profile, sector, use_cases } = req.body;
  if (!name) return res.status(400).json({ error: "Company name required" });
  try {
    const company = await prisma.company.create({
      data: {
        name: name.trim(),
        profile: profile || null,
        sector: sector || null,
        createdBy: req.user.id,
        useCases: Array.isArray(use_cases) && use_cases.length
          ? {
              create: use_cases.map((uc) => ({ useCaseId: uc.id, description: uc.text })),
            }
          : undefined,
      },
      select: { id: true },
    });
    res.status(201).json({ id: company.id });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/companies/:id
router.put("/:id", authenticateToken, async (req, res) => {
  const { name, profile, sector, locked, use_cases } = req.body;
  try {
    const existing = await prisma.company.findUnique({
      where: { id: req.params.id },
      select: { id: true, createdBy: true },
    });
    if (!existing) return res.status(404).json({ error: "Company not found" });
    if (existing.createdBy !== req.user.id)
      return res.status(403).json({ error: "You can only edit your own company profiles" });

    await prisma.company.update({
      where: { id: req.params.id },
      data: {
        ...(name ? { name } : {}),
        ...(profile !== undefined ? { profile } : {}),
        ...(sector !== undefined ? { sector } : {}),
        ...(locked !== undefined ? { locked } : {}),
      },
    });

    if (Array.isArray(use_cases)) {
      await prisma.companyUseCase.deleteMany({ where: { companyId: req.params.id } });
      if (use_cases.length) {
        await prisma.companyUseCase.createMany({
          data: use_cases.map((uc) => ({
            companyId: req.params.id,
            useCaseId: uc.id,
            description: uc.text,
          })),
        });
      }
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
