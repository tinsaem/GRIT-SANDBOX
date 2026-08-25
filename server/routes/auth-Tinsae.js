const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const prisma = require("../prisma/client");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../email");
const { authenticateToken } = require("../middleware/auth");

const VALID_ROLES = ["Student", "Professor", "Advisor", "Employer", "Peer"];

function issueJwt(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

async function createWallet(userId, role) {
  const startBalance = role === "Professor" ? 5500 : 500;
  await prisma.tokenWallet.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: startBalance },
  });
  await prisma.tokenLedger.create({
    data: {
      kind: "account_creation",
      amount: 500,
      toUserId: userId,
      toLabel: role,
      note: "Welcome bonus — account created",
    },
  });
}

// ── Google OAuth Strategy ─────────────────────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "placeholder",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder",
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (_req, _at, _rt, profile, done) => {
      try {
        const email = (profile.emails || [])[0]?.value || "";

        const existing = await prisma.user.findUnique({ where: { googleId: profile.id } });
        if (existing) return done(null, existing);

        const byEmail = email
          ? await prisma.user.findUnique({ where: { email } })
          : null;
        if (byEmail) {
          await prisma.user.update({ where: { id: byEmail.id }, data: { googleId: profile.id } });
          return done(null, byEmail);
        }

        return done(null, { _googleNew: true, googleId: profile.id, email, name: profile.displayName });
      } catch (err) {
        return done(err);
      }
    }
  )
);
passport.serializeUser((u, done) => done(null, u));
passport.deserializeUser((u, done) => done(null, u));

// ── POST /api/auth/signup ──────────────────────────────────────────────────────
router.post("/signup", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: "name, email, password and role are all required" });
  if (!VALID_ROLES.includes(role))
    return res.status(400).json({ error: "Invalid role. Must be one of: " + VALID_ROLES.join(", ") });
  if (password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters" });

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing && existing.emailVerified)
      return res.status(409).json({ error: "An account with this email already exists" });

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = generateOtp();
    const verificationTokenExpires = new Date(Date.now() + 10 * 60 * 1000);

    // An unverified row from an abandoned signup doesn't block a retry —
    // overwrite it with the latest details and a fresh OTP instead.
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: name.trim(),
            passwordHash,
            role,
            verificationToken,
            verificationTokenExpires,
          },
          select: { id: true, name: true, email: true, role: true },
        })
      : await prisma.user.create({
          data: {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            passwordHash,
            role,
            emailVerified: false,
            verificationToken,
            verificationTokenExpires,
          },
          select: { id: true, name: true, email: true, role: true },
        });

    await createWallet(user.id, role);

    try {
      await sendVerificationEmail(user.email, user.name, verificationToken);
    } catch (emailErr) {
      console.warn("Email send failed (non-fatal):", emailErr.message);
    }

    res.status(201).json({
      message: "Account created! Enter the code we emailed you to verify your account.",
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("signup error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// ── POST /api/auth/verify-otp ──────────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: "Email and code are required" });
  try {
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        verificationToken: otp.trim(),
        verificationTokenExpires: { gt: new Date() },
      },
      include: { wallet: { select: { balance: true } } },
    });
    if (!user)
      return res.status(400).json({ error: "That code is invalid or has expired." });

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null, verificationTokenExpires: null },
    });

    const token = issueJwt(user);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token_balance: user.wallet?.balance ?? 0,
      },
    });
  } catch (err) {
    console.error("verify-otp error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /api/auth/login ───────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { wallet: { select: { balance: true } } },
    });
    if (!user)
      return res.status(401).json({ error: "Invalid email or password" });

    if (!user.passwordHash)
      return res.status(401).json({ error: "This account uses Google Sign-In. Please use the Google button." });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    if (!user.emailVerified)
      return res.status(403).json({
        error: "Please verify your email before logging in.",
        needsVerification: true,
        email: user.email,
      });

    const token = issueJwt(user);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token_balance: user.wallet?.balance ?? 0,
      },
    });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// ── GET /api/auth/google?role=Student ─────────────────────────────────────────
router.get("/google", (req, res, next) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const isPlaceholder =
    !clientId ||
    clientId.startsWith("your-google") ||
    clientId === "placeholder" ||
    !clientId.endsWith(".apps.googleusercontent.com");
  if (isPlaceholder) {
    return res.redirect(
      `${process.env.CLIENT_URL || "http://localhost:5173"}/auth?error=google_not_configured`
    );
  }
  const { role } = req.query;
  if (role && role !== "pending" && !VALID_ROLES.includes(role))
    return res.redirect(`${process.env.CLIENT_URL}/auth?error=invalid_role`);
  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: role || "pending",
    session: false,
  })(req, res, next);
});

// ── GET /api/auth/google/callback ─────────────────────────────────────────────
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/auth?error=google_failed`,
  }),
  async (req, res) => {
    try {
      const role = req.query.state;
      const gUser = req.user;

      if (gUser._googleNew) {
        if (!role || !VALID_ROLES.includes(role))
          return res.redirect(
            `${process.env.CLIENT_URL}/auth?error=role_required&google=1&name=${encodeURIComponent(gUser.name)}&email=${encodeURIComponent(gUser.email)}&gid=${gUser.googleId}`
          );

        const newUser = await prisma.user.create({
          data: { name: gUser.name, email: gUser.email, googleId: gUser.googleId, role, emailVerified: true },
          select: { id: true, name: true, email: true, role: true },
        });
        await createWallet(newUser.id, role);
        const token = issueJwt(newUser);
        return res.redirect(`${process.env.CLIENT_URL}/auth?token=${token}&role=${newUser.role}&new=true`);
      }

      const token = issueJwt(gUser);
      res.redirect(`${process.env.CLIENT_URL}/auth?token=${token}&role=${gUser.role}`);
    } catch (err) {
      console.error("google callback error:", err);
      res.redirect(`${process.env.CLIENT_URL}/auth?error=server_error`);
    }
  }
);

// ── GET /api/auth/me ───────────────────────────────────────────────────────────
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, role: true,
        hederaAddress: true, profileText: true, emailVerified: true, createdAt: true,
        wallet: { select: { balance: true } },
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
      ...user,
      hedera_address: user.hederaAddress,
      profile_text: user.profileText,
      email_verified: user.emailVerified,
      created_at: user.createdAt,
      token_balance: user.wallet?.balance ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /api/auth/resend-verification ────────────────────────────────────────
router.post("/resend-verification", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, name: true, emailVerified: true },
    });
    if (!user) return res.status(404).json({ error: "No account found with that email" });
    if (user.emailVerified) return res.status(400).json({ error: "Email already verified" });

    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken: otp, verificationTokenExpires: expires },
    });
    try {
      await sendVerificationEmail(email, user.name, otp);
    } catch (emailErr) {
      console.warn("Email send failed (non-fatal):", emailErr.message);
    }
    res.json({ message: "Verification code resent" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, name: true },
    });
    if (!user) return res.json({ message: "If that email exists, a reset link has been sent." });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpires: expires },
    });
    await sendPasswordResetEmail(email, user.name, token);
    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: "Token and new password required" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  try {
    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpires: { gt: new Date() } },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) return res.status(400).json({ error: "Invalid or expired reset link" });

    const hash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash, resetToken: null, resetTokenExpires: null },
    });

    const jwtToken = issueJwt(user);
    res.json({
      message: "Password updated",
      token: jwtToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
