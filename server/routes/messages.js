const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { authenticateToken } = require("../middleware/keycloakAuth");

// kind → who may send it, and where it may go
const KIND_RULES = {
  opportunity:         { senders: ["Employer", "Professor", "Advisor"], target: "user", targetRole: "Student" },
  curriculum_feedback: { senders: ["Employer", "Professor", "Advisor", "Student"], target: "role", toRoleBySender: { Employer: "Professor", Professor: "Employer", Advisor: "Employer", Student: "Employer" } },
  guidance_feedback:   { senders: ["Employer", "Professor", "Student"], target: "role", toRole: "Advisor" },
};

// POST /api/messages — send a message
router.post("/", authenticateToken, async (req, res) => {
  const { kind, to_user_id, subject, body } = req.body;
  const rule = KIND_RULES[kind];

  if (!rule) return res.status(400).json({ error: "Invalid message kind" });
  if (!rule.senders.includes(req.user.role))
    return res.status(403).json({ error: `Only ${rule.senders.join(", ")} can send ${kind.replace("_", " ")} messages` });
  if (!subject?.trim() || !body?.trim())
    return res.status(400).json({ error: "Subject and body are required" });
  if (subject.length > 200 || body.length > 5000)
    return res.status(400).json({ error: "Subject max 200 chars, body max 5000 chars" });

  try {
    let data = {
      kind,
      fromUserId: req.user.id,
      subject: subject.trim(),
      body: body.trim(),
    };

    if (rule.target === "user") {
      if (!to_user_id) return res.status(400).json({ error: "to_user_id is required for this message kind" });
      const recipient = await prisma.user.findFirst({
        where: { id: to_user_id, role: rule.targetRole },
        select: { id: true },
      });
      if (!recipient) return res.status(404).json({ error: `${rule.targetRole} not found` });
      data.toUserId = to_user_id;
    } else {
      data.toRole = rule.toRoleBySender ? rule.toRoleBySender[req.user.role] : rule.toRole;
      if (!data.toRole) return res.status(400).json({ error: "No recipient role for this message kind" });
    }

    const msg = await prisma.message.create({ data });
    res.status(201).json({ id: msg.id, message: "Message sent" });
  } catch (err) {
    console.error("message send error:", err);
    res.status(500).json({ error: "Server error sending message" });
  }
});

// GET /api/messages/inbox — messages addressed to me or my role
router.get("/inbox", authenticateToken, async (req, res) => {
  try {
    const msgs = await prisma.message.findMany({
      where: { OR: [{ toUserId: req.user.id }, { toRole: req.user.role }] },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { from: { select: { name: true, role: true } } },
    });
    res.json(
      msgs.map((m) => ({
        id: m.id,
        kind: m.kind,
        subject: m.subject,
        body: m.body,
        from_name: m.from.name,
        from_role: m.from.role,
        created_at: m.createdAt,
      }))
    );
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/messages/sent — messages I sent
router.get("/sent", authenticateToken, async (req, res) => {
  try {
    const msgs = await prisma.message.findMany({
      where: { fromUserId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { to: { select: { name: true } } },
    });
    res.json(
      msgs.map((m) => ({
        id: m.id,
        kind: m.kind,
        subject: m.subject,
        body: m.body,
        to_name: m.to?.name || (m.toRole ? `All ${m.toRole}s` : "—"),
        created_at: m.createdAt,
      }))
    );
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
