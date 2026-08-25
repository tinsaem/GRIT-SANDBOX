import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { authAPI } from "../api";

/* =============================================================================
   ResetPasswordPage

   Three defences against the reported bug ("the link logs me straight in
   without asking for a new password"):

   1. Any existing session is destroyed the instant this page mounts. A stale
      token in localStorage can no longer carry the user past this screen.
   2. The token is validated against the server BEFORE the form renders, so a
      dead link produces a clear message instead of an ambiguous redirect.
   3. The backend no longer returns a JWT on success. The user must sign in
      explicitly with the new password, which proves it actually changed.
   ========================================================================== */

const C = {
  ink: "#0E1116", inkSoft: "#2A2F3A", muted: "#6B7280",
  paper: "#F7F3EC", paperWarm: "#EFE7D6", rule: "#D8CFBE",
  gold: "#B8862F", goldDeep: "#8C6420",
  green: "#1F7A3A", greenSoft: "#D4EAD8",
  red: "#B42318", redSoft: "#FDE7E4",
};
const font = { fontFamily: "'DM Sans', system-ui, sans-serif" };
const inputStyle = {
  ...font, width: "100%", boxSizing: "border-box", padding: "11px 13px",
  fontSize: 14, border: `1px solid ${C.rule}`, borderRadius: 8,
  background: "#fff", color: C.ink, outline: "none",
};

function scorePassword(pw) {
  if (!pw) return { score: 0, label: "", color: C.muted };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const map = [
    { label: "Too short", color: C.red }, { label: "Weak", color: C.red },
    { label: "Fair", color: "#C77700" }, { label: "Good", color: "#5A8A2E" },
    { label: "Strong", color: C.green }, { label: "Very strong", color: C.green },
  ];
  return { score: s, ...map[Math.min(s, 5)] };
}

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  /* DEFENCE 1 — kill any existing session immediately. Without this, a user
     who is still logged in elsewhere gets bounced to the dashboard and never
     sees this form, which is exactly the reported symptom. */
  useEffect(() => {
    localStorage.removeItem("givt_token");
    localStorage.removeItem("givt_user");
  }, []);

  /* DEFENCE 2 — validate the token before rendering the form. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError("This reset link is incomplete. Please request a new one.");
        setChecking(false);
        return;
      }
      try {
        const res = await authAPI.validateResetToken(token);
        if (cancelled) return;
        setTokenValid(true);
        setAccountEmail(res.data?.email || "");
      } catch (err) {
        if (cancelled) return;
        setError(
          err?.response?.data?.error ||
            "This reset link is invalid, has expired, or has already been used."
        );
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const strength = scorePassword(password);
  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;
  const canSubmit = password.length >= 8 && password === confirm && !loading;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");

    setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      setDone(true);
      /* DEFENCE 3 — no auto sign-in. Send them to the login screen so they
         must use the new password. */
      setTimeout(() => {
        navigate(`/auth?mode=login&reset=success${accountEmail ? `&email=${encodeURIComponent(accountEmail)}` : ""}`, { replace: true });
      }, 2200);
    } catch (err) {
      setError(err?.response?.data?.error || "Could not reset your password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  /* ------------------------------------------------------------- checking */
  if (checking) {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "26px 0" }}>
          <div style={{ ...font, fontSize: 14, color: C.muted }}>Checking your reset link…</div>
        </div>
      </Shell>
    );
  }

  /* ---------------------------------------------------------- bad token */
  if (!tokenValid) {
    return (
      <Shell>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%", background: C.redSoft,
            display: "grid", placeItems: "center", margin: "0 auto 16px",
            fontSize: 24, color: C.red,
          }}>!</div>
          <h2 style={{ ...font, margin: "0 0 10px", fontSize: 19, fontWeight: 700, color: C.ink }}>
            Link no longer valid
          </h2>
          <p style={{ ...font, margin: "0 0 22px", fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
            {error}
          </p>
          <Link to="/auth?mode=login" style={{
            ...font, display: "inline-block", background: C.gold, color: "#fff",
            padding: "11px 22px", borderRadius: 8, textDecoration: "none",
            fontWeight: 700, fontSize: 14,
          }}>Request a new reset link</Link>
        </div>
      </Shell>
    );
  }

  /* ------------------------------------------------------------- success */
  if (done) {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "14px 0" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%", background: C.greenSoft,
            display: "grid", placeItems: "center", margin: "0 auto 16px",
            fontSize: 25, color: C.green,
          }}>✓</div>
          <h2 style={{ ...font, margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: C.ink }}>
            Password changed
          </h2>
          <p style={{ ...font, margin: 0, fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
            Taking you to the sign-in page. Use your <strong>new</strong> password.
          </p>
        </div>
      </Shell>
    );
  }

  /* ---------------------------------------------------------------- form */
  return (
    <Shell>
      <h2 style={{ ...font, margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: C.ink, letterSpacing: -.3 }}>
        Set a new password
      </h2>
      <p style={{ ...font, margin: "0 0 22px", fontSize: 13.5, color: C.muted, lineHeight: 1.55 }}>
        {accountEmail
          ? <>Choose a new password for <strong style={{ color: C.inkSoft }}>{accountEmail}</strong>.</>
          : "Choose a new password for your GIVT account."}
      </p>

      {error && (
        <div style={{
          ...font, background: C.redSoft, border: `1px solid ${C.red}55`, color: C.red,
          padding: "10px 13px", borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 500,
        }}>{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={{ ...font, display: "block", fontSize: 12.5, fontWeight: 600, color: C.inkSoft, marginBottom: 6 }}>
            New password <span style={{ color: C.red }}>*</span>
          </span>
          <div style={{ position: "relative" }}>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              autoFocus
              style={{ ...inputStyle, paddingRight: 62, borderColor: tooShort ? C.red : C.rule }}
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} style={{
              ...font, position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 11.5, fontWeight: 600, color: C.goldDeep, padding: 4,
            }}>{showPw ? "Hide" : "Show"}</button>
          </div>
          {password && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", gap: 3, marginBottom: 5 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} style={{
                    flex: 1, height: 3, borderRadius: 2,
                    background: i < strength.score ? strength.color : C.paperWarm,
                    transition: "background .2s",
                  }} />
                ))}
              </div>
              <span style={{ ...font, fontSize: 11.5, color: strength.color, fontWeight: 600 }}>
                {strength.label}
              </span>
            </div>
          )}
        </label>

        <label style={{ display: "block", marginBottom: 20 }}>
          <span style={{ ...font, display: "block", fontSize: 12.5, fontWeight: 600, color: C.inkSoft, marginBottom: 6 }}>
            Confirm new password <span style={{ color: C.red }}>*</span>
          </span>
          <input
            type={showPw ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your new password"
            autoComplete="new-password"
            style={{ ...inputStyle, borderColor: mismatch ? C.red : confirm && !mismatch ? C.green : C.rule }}
          />
          {mismatch && (
            <span style={{ ...font, display: "block", fontSize: 11.5, color: C.red, marginTop: 5, fontWeight: 500 }}>
              Passwords do not match
            </span>
          )}
          {confirm && !mismatch && (
            <span style={{ ...font, display: "block", fontSize: 11.5, color: C.green, marginTop: 5, fontWeight: 500 }}>
              ✓ Passwords match
            </span>
          )}
        </label>

        <button type="submit" disabled={!canSubmit} style={{
          ...font, width: "100%", padding: "12px 20px", fontSize: 14.5, fontWeight: 700,
          background: canSubmit ? C.gold : C.rule,
          color: canSubmit ? "#fff" : C.muted,
          border: "none", borderRadius: 8,
          cursor: canSubmit ? "pointer" : "not-allowed", transition: "background .18s",
        }}>
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>

      <p style={{ ...font, textAlign: "center", marginTop: 20, marginBottom: 0, fontSize: 13, color: C.muted }}>
        <Link to="/auth?mode=login" style={{ color: C.goldDeep, fontWeight: 600, textDecoration: "none" }}>
          Back to sign in
        </Link>
      </p>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{
      minHeight: "100vh", background: C.paper,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ width: "100%", maxWidth: 430 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Link to="/" style={{
            ...font, fontSize: 21, fontWeight: 700, color: C.ink,
            textDecoration: "none", letterSpacing: -.5,
          }}>GIVT</Link>
        </div>
        <div style={{
          background: "#fff", border: `1px solid ${C.rule}`, borderRadius: 14,
          padding: "30px 28px", boxShadow: "0 2px 14px rgba(14,17,22,.06)",
        }}>{children}</div>
      </div>
    </div>
  );
}
