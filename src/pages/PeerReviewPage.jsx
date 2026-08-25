import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import PeerReviewPanel from "./PeerReviewPanel";

/* Page shell around PeerReviewPanel, reachable at /peer-review.
   Kept separate from GIVTDashboard so the peer flow can be tested and demoed
   on its own without touching the agent workspace. */

const C = {
  ink: "#0E1116", muted: "#6B7280", paper: "#F7F3EC",
  rule: "#D8CFBE", card: "#FFFFFF", gold: "#B8862F", violet: "#3B5BA5",
};
const font = { fontFamily: "'DM Sans', system-ui, sans-serif" };

export default function PeerReviewPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ ...font, minHeight: "100vh", background: C.paper, color: C.ink }}>
      <header style={{
        background: C.card, borderBottom: `1px solid ${C.rule}`,
        padding: "0 24px", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{
          maxWidth: 1000, margin: "0 auto", display: "flex",
          alignItems: "center", justifyContent: "space-between", height: 62, gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, background: C.violet,
              display: "grid", placeItems: "center", color: "#fff",
              fontWeight: 700, fontSize: 15, flexShrink: 0,
            }}>P</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: -.2 }}>Peer Evaluation</div>
              <div style={{ fontSize: 11.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.name} · Student
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 9 }}>
            <Btn onClick={() => navigate("/dashboard")}>← Dashboard</Btn>
            <Btn onClick={() => { logout(); navigate("/"); }}>Sign out</Btn>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "22px 24px 60px" }}>
        <PeerReviewPanel />
      </main>
    </div>
  );
}

function Btn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      ...font, background: "transparent", color: "#2A2F3A",
      border: `1px solid ${C.rule}`, padding: "7px 14px", borderRadius: 8,
      fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}
