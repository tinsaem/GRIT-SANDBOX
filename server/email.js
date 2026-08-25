const nodemailer = require("nodemailer");
require("dotenv").config();

const isPlaceholder =
  !process.env.SMTP_USER ||
  !process.env.SMTP_PASS ||
  process.env.SMTP_USER.startsWith("your-");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Fail loud and early instead of only discovering a bad SMTP config when the
// first signup silently doesn't deliver an email.
if (isPlaceholder) {
  console.warn(
    "\n⚠ SMTP is not configured (server/.env still has placeholder SMTP_USER/SMTP_PASS)." +
    "\n  Verification and password-reset emails will fail to send until you set real credentials.\n"
  );
} else {
  transporter.verify((err) => {
    if (err) {
      console.error("\n✗ SMTP connection failed — emails will NOT be delivered.");
      console.error(`  ${err.message}\n`);
    } else {
      console.log(`\n✓ SMTP ready — sending as ${process.env.SMTP_USER} via ${process.env.SMTP_HOST}\n`);
    }
  });
}

async function sendVerificationEmail(to, name, otp) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || "GIVT Platform <noreply@givt.edu>",
    to,
    subject: `${otp} is your GIVT verification code`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#F7F3EC;border:1px solid #D8CFBE;border-radius:6px">
        <h2 style="font-family:Georgia,serif;color:#0E1116;margin-top:0">Welcome to GIVT, ${name}!</h2>
        <p style="color:#2A2F3A">GIVT — Gamified, Individualized, Verified Talent — is your platform for closing the gap between academic preparation and employer demand.</p>
        <p style="color:#2A2F3A">Enter this code to verify your email and activate your account:</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#B8862F;background:#fff;border:1px solid #D8CFBE;border-radius:4px;padding:16px 0;text-align:center;margin:8px 0">${otp}</div>
        <p style="color:#888;font-size:12px;margin-top:24px">This code expires in 10 minutes. If you did not create this account, you can safely ignore this email.</p>
      </div>`,
  });
}

async function sendPasswordResetEmail(to, name, token) {
  const url = `${process.env.CLIENT_URL}/auth/reset/${token}`;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || "GIVT Platform <noreply@givt.edu>",
    to,
    subject: "Reset your GIVT password",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#F7F3EC;border:1px solid #D8CFBE;border-radius:6px">
        <h2 style="font-family:Georgia,serif;color:#0E1116;margin-top:0">Password reset, ${name}</h2>
        <p style="color:#2A2F3A">Click the button below to set a new password. This link expires in 1 hour.</p>
        <a href="${url}" style="display:inline-block;background:#B8862F;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:700;margin:8px 0">Reset password</a>
        <p style="color:#888;font-size:12px;margin-top:24px">If you did not request this, ignore this email.</p>
      </div>`,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
