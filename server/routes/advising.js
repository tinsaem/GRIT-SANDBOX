const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { authenticateToken, requireRole } = require("../middleware/keycloakAuth");

const PATHWAYS = new Set(["rise", "substitute"]);
const MAX_DETAIL_LENGTH = 5000;

function serialize(intake) {
  return {
    id: intake.id,
    student_id: intake.studentId,
    student_name: intake.student?.name || null,
    pathway: intake.pathway,
    details: intake.details,
    guidance: intake.guidance || "",
    created_at: intake.createdAt,
    updated_at: intake.updatedAt,
  };
}

// Students can save their own Rise/Substitute input. Advisors can review it.
router.post("/intakes", authenticateToken, requireRole("Student"), async (req, res) => {
  const { pathway, details, guidance } = req.body;
  if (!PATHWAYS.has(pathway)) return res.status(400).json({ error: "Invalid advising pathway" });
  if (!details || typeof details !== "object" || Array.isArray(details))
    return res.status(400).json({ error: "Structured intake details are required" });

  const encodedDetails = JSON.stringify(details);
  if (encodedDetails.length > MAX_DETAIL_LENGTH)
    return res.status(400).json({ error: "Intake details are too long" });
  if (guidance && String(guidance).length > 12000)
    return res.status(400).json({ error: "Guidance is too long" });

  try {
    const intake = await prisma.advisingIntake.create({
      data: {
        studentId: req.user.id,
        pathway,
        details,
        guidance: guidance ? String(guidance).trim() : null,
      },
      include: { student: { select: { name: true } } },
    });
    res.status(201).json(serialize(intake));
  } catch (err) {
    console.error("advising intake create error:", err);
    res.status(500).json({ error: "Could not save advising intake" });
  }
});

// Students receive their own history; advisors receive the review queue.
router.get("/intakes", authenticateToken, requireRole("Student", "Advisor"), async (req, res) => {
  const where = req.user.role === "Student"
    ? { studentId: req.user.id }
    : { ...(req.query.student_id ? { studentId: req.query.student_id } : {}) };

  try {
    const intakes = await prisma.advisingIntake.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { student: { select: { name: true } } },
    });
    res.json(intakes.map(serialize));
  } catch (err) {
    console.error("advising intake list error:", err);
    res.status(500).json({ error: "Could not load advising intakes" });
  }
});

module.exports = router;