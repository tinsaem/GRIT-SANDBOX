import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { authAPI } from "../api";
import { keycloakEnabled, kcLogin, kcRegister, AUTH_MODE } from "../keycloak";

const C = {
  ink: "#0E1116", inkSoft: "#2A2F3A",
  paper: "#F7F3EC", paperWarm: "#EFE7D6",
  rule: "#D8CFBE",
  gold: "#B8862F", goldDeep: "#8C6420",
  teal: "#2D6E6A", tealDeepOrRule: "#1F4A47",
  rust: "#A04A1E",
  green: "#1F7A3A", greenSoft: "#D4EAD8",
};

const ROLES = [
  { value: "Student",   label: "Student",   icon: "🎓", desc: "Close skill gaps, get verified, peer-review others, earn tokens" },
  { value: "Professor", label: "Professor", icon: "🏫", desc: "Supervise syllabi, verify students, earn tokens" },
  { value: "Employer",  label: "Employer",  icon: "🏢", desc: "Profile your org, verify candidates' skills" },
  { value: "Advisor",   label: "Advisor",   icon: "🧭", desc: "Build pathways, map curriculum to demand" },
];

const inputStyle = {
  width: "100%", boxSizing: "border-box",
  fontFamily: "'DM Sans', sans-serif", fontSize: 14,
  padding: "10px 12px", border: "1px solid " + C.rule,
  borderRadius: 4, background: C.paper, color: C.ink, outline: "none",
};

export default function AuthPage() {
  const [params] = useSearchParams();
  const navigate   = useNavigate();
  const { login, user } = useAuth();

  // Detect an in-flight OAuth / email-verification redirect BEFORE any state is set.
  // When Google (or the verify link) sends back ?token=...&role=..., we must not
  // render the form at all — just show a brief loading screen while the effect below
  // processes the token and navigates to the dashboard.
  const isOAuthCallback = !!(params.get("token") && params.get("role") && !params.get("error"));

  const initialMode = params.get("mode") === "login" ? "login" : "signup";
  // Set by ResetPasswordPage after a successful password change, so the user
  // gets confirmation on the screen where they now have to use the new password.
  const resetSuccess = params.get("reset") === "success";
  const prefillEmail = params.get("email") || "";
  const [mode, setMode]         = useState(initialMode);
  const [role, setRole]         = useState("");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [signupDone, setSignupDone] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  // True when email delivery failed at signup time — prompts user to resend.
  const [signupEmailFailed, setSignupEmailFailed] = useState(false);
  // True when user landed on OTP screen because login was blocked (unverified).
  const [blockedLogin, setBlockedLogin] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpNotice, setOtpNotice] = useState("");

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  // Handle redirect from email verification / Google OAuth
  useEffect(() => {
    const token  = params.get("token");
    const pRole  = params.get("role");
    const errMsg = params.get("error");

    if (errMsg) {
      const msgs = {
        google_failed: "Google sign-in failed. Please try again.",
        role_required: "No existing account found for that Google address. Switch to Sign Up and select a role to create one.",
        server_error: "A server error occurred. Please try again.",
        invalid_role: "Invalid role selected.",
        google_not_configured:
          "Google Sign-In is not configured yet — credentials are missing in the server .env. Use email & password for now.",
      };
      setError(msgs[errMsg] || "Something went wrong.");
    }
    if (token && pRole) {
      const userData = { role: pRole };
      login(token, userData);
      navigate("/dashboard", { replace: true });
    }
  }, [params]);

  // Show a blank loading screen while the OAuth token is being processed —
  // this replaces the form so it never flashes on screen.
  if (isOAuthCallback) {
    return (
      <div style={{
        minHeight: "100vh", background: C.ink,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16,
      }}>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 600, color: C.paper }}>GIVT</span>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(247,243,236,.6)" }}>
          Signing you in…
        </span>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          border: "3px solid rgba(247,243,236,.2)",
          borderTopColor: C.gold,
          animation: "givtspin .8s linear infinite",
        }} />
        <style>{`@keyframes givtspin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── OTP entry screen ─────────────────────────────────────────────────────────
  if (signupDone) {
    const handleVerifyOtp = async (e) => {
      e.preventDefault();
      setOtpError(""); setOtpNotice("");
      if (otp.trim().length !== 6) return setOtpError("Enter the 6-digit code from your email.");
      setLoading(true);
      try {
        const res = await authAPI.verifyOtp(signupEmail, otp.trim());
        login(res.data.token, res.data.user);
        navigate("/dashboard", { replace: true });
      } catch (err) {
        setOtpError(err.response?.data?.error || "Verification failed. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    const handleResendOtp = async () => {
      setOtpError(""); setOtpNotice("");
      setLoading(true);
      try {
        await authAPI.resendVerification(signupEmail);
        setOtpNotice("A new code has been sent.");
      } catch (err) {
        setOtpError(err.response?.data?.error || "Could not resend. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    return (
      <div style={{ minHeight: "100vh", background: C.ink, display: "flex", flexDirection: "column" }}>
        <header style={{ borderBottom: "1px solid rgba(255,255,255,.07)", padding: "14px 32px" }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, color: C.paper }}>GIVT</span>
        </header>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: 420, background: C.paper, border: "1px solid " + C.rule, borderTop: "4px solid " + C.green, borderRadius: 8, padding: "36px 32px", boxShadow: "0 20px 60px rgba(0,0,0,.4)", textAlign: "center" }}>
            <CloseButton onClick={() => navigate("/")} />
            <div style={{ fontSize: 44, marginBottom: 12 }}>🔐</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, margin: "0 0 10px", color: C.ink }}>Enter your code</h2>
            {/* Context banner: blocked login */}
            {blockedLogin && (
              <div style={{ background: "#FEF9C3", border: "1px solid #CA8A04", color: "#713F12", borderRadius: 4, padding: "10px 13px", marginBottom: 14, fontFamily: "'DM Sans', sans-serif", fontSize: 13, textAlign: "left", lineHeight: 1.5 }}>
                <strong>Your account isn't verified yet.</strong> We've sent a fresh code to the address below. Enter it to activate your account and sign in.
              </div>
            )}

            {/* Context banner: email delivery failed at signup */}
            {signupEmailFailed && (
              <div style={{ background: "#FEF9C3", border: "1px solid #CA8A04", color: "#713F12", borderRadius: 4, padding: "10px 13px", marginBottom: 14, fontFamily: "'DM Sans', sans-serif", fontSize: 13, textAlign: "left", lineHeight: 1.5 }}>
                <strong>Verification email couldn't be delivered.</strong> Your account was created, but the email send failed. Click <em>Resend code</em> below to try again, or contact your administrator to verify your account manually.
              </div>
            )}

            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: C.inkSoft, marginBottom: 6 }}>
              {signupEmailFailed ? "Email address on file:" : "We sent a 6-digit code to"}
            </p>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: C.teal, fontWeight: 700, marginBottom: 22, wordBreak: "break-all" }}>
              {signupEmail}
            </p>

            {otpError && (
              <div style={{ background: "#FEE2E2", border: "1px solid #EF4444", color: "#991B1B", borderRadius: 4, padding: "9px 12px", marginBottom: 14, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
                {otpError}
              </div>
            )}
            {otpNotice && (
              <div style={{ background: C.greenSoft, border: "1px solid " + C.green, color: C.teal, borderRadius: 4, padding: "9px 12px", marginBottom: 14, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
                {otpNotice}
              </div>
            )}

            <form onSubmit={handleVerifyOtp}>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric" maxLength={6} placeholder="000000" autoFocus
                style={{ ...inputStyle, textAlign: "center", fontSize: 26, letterSpacing: 10, fontFamily: "'JetBrains Mono', monospace", marginBottom: 18, padding: "12px" }}
              />
              <button type="submit" disabled={loading} style={{
                width: "100%", padding: "12px 16px", background: C.gold, color: "#fff",
                border: "none", borderRadius: 4, fontFamily: "'DM Sans', sans-serif",
                fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1, marginBottom: 14,
              }}>
                {loading ? "Verifying…" : "Verify & continue →"}
              </button>
            </form>

            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: C.inkSoft, margin: "4px 0 10px", lineHeight: 1.5 }}>
              Didn't receive it? Check your spam folder, then:
            </p>
            <button onClick={handleResendOtp} disabled={loading} style={{
              width: "100%", padding: "10px 16px", background: "transparent",
              border: "1.5px solid " + C.teal, color: C.teal, borderRadius: 4,
              fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
            }}>
              Resend verification code
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!role) return setError("Please select your role to continue.");
    if (password !== confirmPw) return setError("Passwords do not match.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    try {
      const res = await authAPI.signup({ name, email, password, role });
      setSignupEmail(email);
      setSignupEmailFailed(!res.data.emailSent);
      setBlockedLogin(false);
      setSignupDone(true);
    } catch (err) {
      setError(err.response?.data?.error || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      const res = await authAPI.login({ email, password });
      login(res.data.token, res.data.user);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data?.needsVerification) {
        // Blocked login: silently resend a fresh OTP then drop the user on the
        // OTP entry screen with a clear explanation of why they're there.
        try {
          await authAPI.resendVerification(email);
        } catch { /* account may already have a live code — proceed anyway */ }
        setSignupEmail(data.email || email);
        setSignupEmailFailed(false);
        setBlockedLogin(true);
        setSignupDone(true);
      } else {
        setError(data?.error || "Login failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    if (mode === "signup" && !role)
      return setError("Please select your role before continuing with Google.");
    // In login mode send "pending" — the server looks up the existing account's role automatically.
    window.location.href = authAPI.googleUrl(mode === "signup" ? role : "pending");
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await authAPI.forgotPassword(forgotEmail);
      setSuccess("If that email exists, a reset link has been sent.");
      setShowForgot(false);
    } catch {
      setSuccess("If that email exists, a reset link has been sent.");
      setShowForgot(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.ink, display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,.07)", padding: "14px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link to="/" style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, color: C.paper, textDecoration: "none" }}>
          GIVT <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#888", fontWeight: 400, marginLeft: 6 }}>Gamified · Individualized · Verified Talent</span>
        </Link>
        <button onClick={() => setMode(mode === "login" ? "signup" : "login")} style={{ background: "transparent", border: "1px solid " + C.rule, color: C.paper, borderRadius: 4, padding: "8px 16px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          {mode === "login" ? "Create account" : "Sign in"}
        </button>
      </header>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
        <div style={{ width: "100%", maxWidth: 480 }}>

          {/* Card */}
          <div style={{ position: "relative", background: C.paper, border: "1px solid " + C.rule, borderTop: "4px solid " + C.gold, borderRadius: 8, padding: "32px 30px", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
            <CloseButton onClick={() => navigate("/")} />

            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, margin: "0 0 4px", color: C.ink }}>
              {mode === "signup" ? "Create your GIVT account" : "Welcome back"}
            </h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: C.inkSoft, marginBottom: 22 }}>
              {mode === "signup"
                ? <>Join and earn <strong style={{ color: C.goldDeep }}>+500 GIVT tokens</strong> instantly.</>
                : "Sign in to access your GIVT dashboard."}
            </p>

            {/* Error / Success banners */}
            {error && (
              <div style={{ background: "#FEE2E2", border: "1px solid #EF4444", color: "#991B1B", borderRadius: 4, padding: "10px 14px", marginBottom: 16, fontFamily: "'DM Sans', sans-serif", fontSize: 13.5 }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ background: C.greenSoft, border: "1px solid " + C.green, color: C.teal, borderRadius: 4, padding: "10px 14px", marginBottom: 16, fontFamily: "'DM Sans', sans-serif", fontSize: 13.5 }}>
                {success}
              </div>
            )}

            {/* Role selection — signup only */}
            {mode === "signup" && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 700, color: C.inkSoft, marginBottom: 8, letterSpacing: ".02em" }}>
                  Select your role (required) *
                </label>
                <div style={{ display: "flex", flexWrap: "nowrap", gap: 6 }}>
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      title={r.desc}
                      onClick={() => setRole(r.value)}
                      style={{
                        flex: "1 1 0", minWidth: 0, boxSizing: "border-box",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                        padding: "10px 4px", borderRadius: 999, cursor: "pointer",
                        border: "1.5px solid " + (role === r.value ? C.gold : C.rule),
                        background: role === r.value
                          ? `linear-gradient(180deg, ${C.gold}, ${C.goldDeep})`
                          : "#fff",
                        boxShadow: role === r.value ? "0 6px 16px rgba(184,134,47,.35)" : "0 1px 2px rgba(0,0,0,.04)",
                        transform: role === r.value ? "translateY(-2px)" : "none",
                        transition: "all .15s ease",
                      }}
                    >
                      <span style={{
                        fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 11.5,
                        color: role === r.value ? "#fff" : C.ink,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
                      }}>
                        {r.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Keycloak / institutional sign-in. Rendered only when
                VITE_AUTH_MODE is "keycloak" or "dual". In "keycloak" mode this
                is the ONLY way in and the email form below is hidden. */}
            {keycloakEnabled && (
              <>
                <button type="button" onClick={() => (mode === "signup" ? kcRegister("/dashboard") : kcLogin("/dashboard"))}
                  style={{
                    width: "100%", padding: "11px 16px", borderRadius: 4,
                    border: "1px solid " + C.tealDeepOrRule, background: C.teal, color: "#fff",
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
                    fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 9, marginBottom: 14,
                  }}>
                  <span style={{ fontSize: 15 }}>🔐</span>
                  {mode === "signup" ? "Register with institutional account" : "Sign in with institutional account"}
                </button>
                {AUTH_MODE === "keycloak" && (
                  <p style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: C.inkSoft,
                    textAlign: "center", margin: "0 0 6px", lineHeight: 1.5,
                  }}>
                    GIVT uses centralised identity management. Password changes and
                    two-factor setup are handled in your account console.
                  </p>
                )}
              </>
            )}

            {/* Google button — local auth only */}
            {AUTH_MODE !== "keycloak" && <button type="button" onClick={handleGoogleAuth} disabled={loading} style={{
              width: "100%", padding: "11px 16px", borderRadius: 4, border: "1px solid " + C.rule,
              background: "#fff", cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14, color: C.ink,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16,
              opacity: loading ? 0.6 : 1,
            }}>
              <GoogleIcon /> Continue with Google
            </button>}

            {/* Divider — local auth only */}
            {AUTH_MODE !== "keycloak" && <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: C.rule }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: C.inkSoft }}>or with email</span>
              <div style={{ flex: 1, height: 1, background: C.rule }} />
            </div>}

            {/* Email form */}
            <form onSubmit={mode === "signup" ? handleSignup : handleLogin}>
              {mode === "signup" && (
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Username *</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. maya_osei" style={inputStyle} />
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" style={inputStyle} />
              </div>
              <div style={{ marginBottom: mode === "signup" ? 12 : 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Password *</label>
                  {mode === "login" && (
                    <button type="button" onClick={() => setShowForgot(true)} style={{ background: "none", border: "none", color: C.teal, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 12, padding: 0 }}>
                      Forgot password?
                    </button>
                  )}
                </div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="8+ characters" style={inputStyle} />
              </div>
              {mode === "signup" && (
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Confirm password *</label>
                  <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required placeholder="Repeat your password" style={inputStyle} />
                </div>
              )}
              <button type="submit" disabled={loading} style={{
                width: "100%", padding: "12px 16px", background: C.gold, color: "#fff",
                border: "none", borderRadius: 4, fontFamily: "'DM Sans', sans-serif",
                fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}>
                {loading ? "Please wait…" : mode === "signup" ? "Create Account · +500 GIVT" : "Sign In →"}
              </button>
            </form>

            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.inkSoft, textAlign: "center", marginTop: 18 }}>
              {mode === "signup" ? (
                <>Already have an account? <button type="button" onClick={() => { setMode("login"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: C.teal, cursor: "pointer", fontWeight: 700, padding: 0, fontSize: 12.5 }}>Sign in</button></>
              ) : (
                <>New to GIVT? <button type="button" onClick={() => { setMode("signup"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: C.teal, cursor: "pointer", fontWeight: 700, padding: 0, fontSize: 12.5 }}>Create an account</button></>
              )}
            </p>
          </div>

          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#888", textAlign: "center", marginTop: 16 }}>
            Kennesaw State University · Healthcare Informatics · 2026
          </p>
        </div>
      </div>

      {/* Forgot password modal */}
      {showForgot && (
        <div onClick={() => setShowForgot(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.paper, borderTop: "3px solid " + C.gold, borderRadius: 6, padding: "24px 26px", maxWidth: 400, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: "0 0 8px", color: C.ink }}>Reset password</h3>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: C.inkSoft, marginBottom: 16 }}>Enter your email and we'll send a reset link.</p>
            <form onSubmit={handleForgotPassword}>
              <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required placeholder="your@email.com" style={{ ...inputStyle, marginBottom: 12 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: "10px", background: C.gold, color: "#fff", border: "none", borderRadius: 4, fontFamily: "'DM Sans', sans-serif", fontWeight: 700, cursor: "pointer" }}>
                  {loading ? "Sending…" : "Send reset link"}
                </button>
                <button type="button" onClick={() => setShowForgot(false)} style={{ padding: "10px 16px", background: "transparent", border: "1px solid " + C.rule, borderRadius: 4, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = {
  display: "block", fontFamily: "'DM Sans', sans-serif",
  fontSize: 12.5, fontWeight: 700, color: C.inkSoft,
  marginBottom: 5, letterSpacing: ".02em",
};

function CloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close and return home"
      style={{
        position: "absolute", top: 14, right: 14,
        width: 30, height: 30, borderRadius: "50%",
        border: "1px solid " + C.rule, background: "#fff", color: C.inkSoft,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, lineHeight: 1, cursor: "pointer",
      }}
    >
      ×
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
