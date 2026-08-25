const express = require("express");
const router = express.Router();

const isPlaceholder = (key) => !key || key.startsWith("your-");

// ── POST /api/agent/messages ───────────────────────────────────────────────────
// Proxies to the Anthropic Messages API using the server-side key so the key
// never reaches the browser bundle. Forwards the request body as-is (model,
// messages, tools, max_tokens, ...) — every in-app agent posts here.
router.post("/messages", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (isPlaceholder(apiKey))
    return res.status(503).json({ error: "ANTHROPIC_API_KEY is not set yet in server/.env" });

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
    const data = await anthropicRes.json();
    res.status(anthropicRes.status).json(data);
  } catch (err) {
    console.error("agent proxy error:", err);
    res.status(500).json({ error: "Agent request failed" });
  }
});

module.exports = router;
