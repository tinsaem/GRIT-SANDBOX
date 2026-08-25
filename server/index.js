require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const passport = require("passport");
const rateLimit = require("express-rate-limit");

const app = express();

// Trust Replit's proxy layer (autoscale sits behind a load balancer).
// Required so express-rate-limit can read the real client IP from X-Forwarded-For.
app.set("trust proxy", 1);

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Rate limiter — strict in production, relaxed in development
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 20 : 200,
  message: { error: "Too many requests, please try again after 15 minutes" },
  skip: () => process.env.NODE_ENV === "development",
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use("/api/auth",          authLimiter, require("./routes/auth"));
app.use("/api/users",                      require("./routes/users"));
app.use("/api/tokens",                     require("./routes/tokens"));
app.use("/api/verifications",              require("./routes/verifications"));
app.use("/api/companies",                  require("./routes/companies"));
app.use("/api/syllabi",                    require("./routes/syllabi"));
app.use("/api/leaderboard",                require("./routes/leaderboard"));
app.use("/api/gan",                        require("./routes/gan"));
app.use("/api/messages",                   require("./routes/messages"));
app.use("/api/advising",                   require("./routes/advising"));
app.use("/api/agent",                      require("./routes/agent"));
app.use("/api/admin",                      require("./routes/admin"));

// ── Health check ───────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "GIVT API" }));

// ── Serve the built frontend (single-process deployment) ───────────────────────
// When ../dist exists (produced by `npm run build` at the repo root), this server
// serves it directly instead of redirecting to a separate frontend URL. This lets
// one Replit deployment host both the API and the React app on one port.
const distDir = path.join(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(distDir, "index.html")));
} else {
  // dist/ not built yet (dev-only path). Return 200 so Replit's startup probe
  // always passes — a 302 redirect would fail the health check and kill the
  // promote step. In production the build command always creates dist/, so
  // this branch should never be reached there.
  app.get("/", (_req, res) =>
    res.status(200).send("GIVT API is running. Build the frontend with `npm run build`.")
  );
}

// ── 404 handler (API routes only reach here; frontend routes are caught above) ──
app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));

// ── Global error handler ───────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const gid = process.env.GOOGLE_CLIENT_ID || "";
  const googleStatus = gid.endsWith(".apps.googleusercontent.com") ? `configured (${gid.slice(0, 12)}…)` : "NOT configured";
  console.log(`\n✓ GIVT API server running on http://localhost:${PORT}`);
  console.log(`  Database: ${process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ":***@") || "not configured"}`);
  console.log(`  Client:   ${process.env.CLIENT_URL || "http://localhost:5173"}`);
  console.log(`  Google:   ${googleStatus}\n`);
});
