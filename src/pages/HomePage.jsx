import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

const C = {
  ink: "#0E1116", inkSoft: "#2A2F3A",
  paper: "#F7F3EC", paperWarm: "#EFE7D6",
  rule: "#D8CFBE",
  gold: "#B8862F", goldDeep: "#8C6420",
  teal: "#2D6E6A", tealDeep: "#1F4A47",
  rust: "#A04A1E",
  green: "#1F7A3A", greenSoft: "#D4EAD8",
};

const AGENTS = [
  { n: "01", name: "Translator", color: C.ink, desc: "Résumé ↔ job description gap analysis. Rewrites your résumé in the employer's exact vocabulary." },
  { n: "02", name: "Talent", color: C.gold, desc: "AI-powered employer profiling. Surfaces use cases and forward-looking talent demand signals." },
  { n: "03", name: "Curriculum", color: C.teal, desc: "Maps existing courses to employer use cases and proposes future curriculum for skill gaps." },
  { n: "04", name: "Advisor", color: C.rust, desc: "Three learning pathways: university courses, professional training, and directed-study syllabi." },
  { n: "05", name: "Reputation", color: C.green, desc: "Stakeholder skill verification. Employers, professors, advisors, and peers verify résumé skills on a weighted ledger." },
  { n: "06", name: "Generator", color: C.teal, desc: "Produces forward-looking curriculum modules grounded in real HIMSS / JMIR innovation sources." },
  { n: "07", name: "Discriminator", color: C.rust, desc: "Validates curriculum against 6 compliance lenses (HIPAA, FHIR, NIST, EU AI Act…). GAN loop converges at equilibrium." },
];

const ROLES = [
  { role: "Student", color: C.teal, desc: "Translate your résumé, close skill gaps, earn tokens, build a verified reputation." },
  { role: "Professor", color: C.teal, desc: "Supervise directed-study syllabi, verify student skills, earn supervision tokens." },
  { role: "Employer", color: C.gold, desc: "Profile your organization, define use cases, verify candidates' résumé skills." },
  { role: "Advisor", color: C.rust, desc: "Build learning pathways, map curriculum to demand, verify and coach students." },
  { role: "Peer", color: C.green, desc: "A capability of every Student — verify fellow students' skills, never your own. No separate registration." },
];

const STATS = [
  { big: "58%", label: "of graduates don't land their first job until 6+ months after graduation" },
  { big: ">50%", label: "of hiring managers say fresh graduates lack required capabilities" },
  { big: "$60B+", label: "total addressable market across AI-in-education, LMS/LXP, skills intelligence & AI-HR" },
];

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Inject Google Fonts once
  useEffect(() => {
    if (document.getElementById("givt-fonts")) return;
    const l1 = document.createElement("link"); l1.rel = "preconnect"; l1.href = "https://fonts.googleapis.com";
    const l2 = document.createElement("link"); l2.id = "givt-fonts"; l2.rel = "stylesheet";
    l2.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap";
    document.head.appendChild(l1); document.head.appendChild(l2);
    const st = document.createElement("style"); st.id = "givt-anim";
    st.textContent = "@keyframes givtspin{to{transform:rotate(360deg)}}@keyframes fadein{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}";
    document.head.appendChild(st);
  }, []);

  const go = (path) => navigate(path);

  return (
    <div style={{ background: C.paper, minHeight: "100vh", color: C.ink }}>

      {/* ── Masthead ── */}
      <header style={{ background: C.ink, borderBottom: "3px solid " + C.gold, padding: "16px 32px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, color: C.paper }}>GIVT</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, marginLeft: 10, color: "#aaa", letterSpacing: ".04em" }}>Gamified · Individualized · Verified Talent</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {user ? (
              <>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#aaa" }}>Signed in as {user.name}</span>
                <button onClick={() => go("/dashboard")} style={btnStyle(C.gold)}>Go to Dashboard →</button>
              </>
            ) : (
              <>
                <button onClick={() => go("/auth?mode=login")} style={btnStyle("transparent", C.paper, C.gold)}>Sign In</button>
                <button onClick={() => go("/auth")} style={btnStyle(C.gold)}>Join GIVT →</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ background: C.ink, color: C.paper, padding: "72px 32px 80px", textAlign: "center" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", animation: "fadein .6s ease" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: ".18em", color: C.gold, marginBottom: 14, textTransform: "uppercase" }}>
            Kennesaw State · 2026
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(36px, 6vw, 68px)", fontWeight: 600, lineHeight: 1.1, margin: "0 0 22px", color: C.paper }}>
            Close the gap between<br />
            <span style={{ color: C.gold }}>education</span> and <span style={{ color: C.teal }}>employment.</span>
          </h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, color: "#bbb", maxWidth: 620, margin: "0 auto 32px", lineHeight: 1.6 }}>
            GIVT is a seven-agent platform that translates résumés, verifies skills through a weighted stakeholder verification ledger, maps curricula to employer demand, and rewards every stakeholder with tokens.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => go("/auth")} style={{ ...btnStyle(C.gold), fontSize: 16, padding: "14px 28px" }}>
              ✦ Join GIVT — Free
            </button>
            <button onClick={() => go("/auth?mode=login")} style={{ ...btnStyle("transparent", C.paper, C.rule), fontSize: 16, padding: "14px 28px" }}>
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ background: C.paperWarm, borderTop: "1px solid " + C.rule, borderBottom: "1px solid " + C.rule, padding: "44px 32px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
          {STATS.map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 48, fontWeight: 600, color: C.gold, lineHeight: 1 }}>{s.big}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: C.inkSoft, marginTop: 8, maxWidth: 240, margin: "8px auto 0" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: "64px 32px", maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: ".16em", color: C.gold, textTransform: "uppercase", marginBottom: 10 }}>How it works</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(28px, 4vw, 42px)", margin: 0, color: C.ink }}>Seven AI agents, one platform</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
          {AGENTS.map((a) => (
            <div key={a.n} style={{ background: "#fff", border: "1px solid " + C.rule, borderTop: "3px solid " + a.color, borderRadius: 6, padding: "18px 20px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: a.color, fontWeight: 600, background: C.paperWarm, border: "1px solid " + C.rule, borderRadius: 3, padding: "2px 7px" }}>{a.n}</span>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: C.ink, fontWeight: 600 }}>{a.name}</span>
              </div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: C.inkSoft, margin: 0, lineHeight: 1.55 }}>{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Roles ── */}
      <section style={{ background: C.ink, padding: "64px 32px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: ".16em", color: C.gold, textTransform: "uppercase", marginBottom: 10 }}>Five stakeholder roles</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(28px, 4vw, 42px)", margin: 0, color: C.paper }}>Everyone earns in GIVT</h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#aaa", marginTop: 10 }}>
              Students, professors, employers, and advisors each earn <strong style={{ color: C.gold }}>500 tokens</strong> for joining.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 240px))", gap: 16, justifyContent: "center" }}>
            {ROLES.map((r) => (
              <div key={r.role} style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderTop: "3px solid " + r.color, borderRadius: 6, padding: "20px 18px" }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: C.paper, fontWeight: 600, marginBottom: 6 }}>{r.role}</div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#aaa", margin: 0, lineHeight: 1.55 }}>{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "72px 32px", textAlign: "center", background: C.paperWarm, borderTop: "1px solid " + C.rule }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(26px, 4vw, 40px)", color: C.ink, margin: "0 0 14px" }}>Ready to close the gap?</h2>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: C.inkSoft, marginBottom: 30 }}>
            Create your account in under a minute. Choose your role, connect with Google or email, and start earning verified credentials today.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => go("/auth")} style={{ ...btnStyle(C.ink), fontSize: 16, padding: "14px 28px" }}>
              Create Account · +500 GIVT →
            </button>
          </div>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.inkSoft, marginTop: 18 }}>
            Free · No credit card · Email or Google sign-in
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: C.ink, color: "#888", textAlign: "center", padding: "22px 32px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        <div>GIVT Platform · Kennesaw State University · Healthcare Informatics</div>
        <div style={{ marginTop: 6 }}>Developed by snegash@kennesaw.edu · © 2026 GIVT Sandbox. All Rights Reserved.</div>
      </footer>
    </div>
  );
}

function btnStyle(bg, color = "#fff", border) {
  return {
    background: bg, color, border: "1px solid " + (border || bg),
    borderRadius: 4, padding: "10px 20px", fontSize: 14,
    fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
    cursor: "pointer", transition: "opacity .15s",
    whiteSpace: "nowrap",
  };
}
