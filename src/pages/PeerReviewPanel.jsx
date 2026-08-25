import React, { useState, useEffect, useCallback } from "react";
import { peerAPI } from "../api";
import { useAuth } from "../AuthContext";

/* =============================================================================
   PeerReviewPanel — a student evaluating other students' skills.

   Rules enforced here AND server-side (the server is authoritative; this UI
   only avoids offering actions that would be rejected):
     • You cannot evaluate yourself — excluded from the candidate list.
     • You cannot evaluate the same student twice — already-evaluated students
       are filtered out of search results and shown separately.
     • You may evaluate at most N distinct students, where N is set by an
       administrator (Admin console → Settings). Default 1.
   ========================================================================== */

const C = {
  ink: "#0E1116", inkSoft: "#2A2F3A", muted: "#6B7280",
  paper: "#F7F3EC", paperWarm: "#EFE7D6", card: "#FFFFFF",
  rule: "#D8CFBE", ruleSoft: "#E8E1D4",
  gold: "#B8862F", goldDeep: "#8C6420", goldSoft: "#F3E8CC",
  teal: "#2D6E6A", tealDeep: "#1F4A47",
  green: "#1F7A3A", greenSoft: "#D4EAD8",
  red: "#B42318", redSoft: "#FDE7E4",
  rust: "#A04A1E",
};
const font = { fontFamily: "'DM Sans', system-ui, sans-serif" };
const input = {
  ...font, width: "100%", boxSizing: "border-box", padding: "10px 12px",
  fontSize: 13.5, border: `1px solid ${C.rule}`, borderRadius: 8,
  background: "#fff", color: C.ink, outline: "none",
};

export default function PeerReviewPanel() {
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [evaluated, setEvaluated] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(null);
  const [target, setTarget] = useState(null);
  const [toast, setToast] = useState({ msg: "", kind: "ok" });

  // Debounce so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setBlocked(null);
    try {
      const res = await peerAPI.candidates(debounced);
      setCandidates(res.data.candidates || []);
      setEvaluated(res.data.alreadyEvaluated || []);
      setQuota(res.data.quota || null);
    } catch (err) {
      const d = err?.response?.data;
      setBlocked(d?.error || "Could not load students");
      if (d?.quota) setQuota(d.quota);
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => { load(); }, [load]);

  const notify = (msg, kind = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast({ msg: "", kind: "ok" }), 4200);
  };

  async function submitScore(form) {
    try {
      await peerAPI.submit(target.id, form.skill, form.confidence, form.comment);
      notify(`Peer evaluation recorded for ${target.name}`);
      setTarget(null);
      load();
    } catch (err) {
      notify(err?.response?.data?.error || "Could not submit evaluation", "error");
      if (err?.response?.data?.peerLimitReached) { setTarget(null); load(); }
    }
  }

  if (user?.role !== "Student") {
    return (
      <Card>
        <p style={{ ...font, margin: 0, fontSize: 13.5, color: C.muted }}>
          Peer evaluation is a student capability. Your role ({user?.role}) verifies
          skills through the Talent agent instead.
        </p>
      </Card>
    );
  }

  const limitLabel =
    quota?.limit === null ? "unlimited"
    : quota?.limit === 0 ? "disabled"
    : `${quota?.used ?? 0} of ${quota?.limit}`;

  return (
    <div style={{ ...font }}>
      {/* header + quota */}
      <div style={{
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        gap: 14, marginBottom: 14, flexWrap: "wrap",
      }}>
        <div>
          <h2 style={{ ...font, margin: 0, fontSize: 19, fontWeight: 700, color: C.ink, letterSpacing: -.3 }}>
            Peer evaluation
          </h2>
          <p style={{ ...font, margin: "3px 0 0", fontSize: 12.5, color: C.muted }}>
            Verify another student's skills. You cannot evaluate yourself.
          </p>
        </div>
        {quota && (
          <div style={{
            background: quota.reached ? C.redSoft : C.goldSoft,
            border: `1px solid ${quota.reached ? C.red + "55" : C.gold + "55"}`,
            borderRadius: 9, padding: "8px 14px", textAlign: "right",
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: .5 }}>
              Your allowance
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: quota.reached ? C.red : C.goldDeep }}>
              {limitLabel}
            </div>
          </div>
        )}
      </div>

      {blocked && (
        <div style={{
          background: C.redSoft, border: `1px solid ${C.red}55`, color: C.red,
          padding: "11px 14px", borderRadius: 9, fontSize: 13, marginBottom: 14, fontWeight: 500,
        }}>{blocked}</div>
      )}

      {quota?.reached && !blocked && (
        <div style={{
          background: C.goldSoft, border: `1px solid ${C.gold}55`, color: C.inkSoft,
          padding: "11px 14px", borderRadius: 9, fontSize: 12.5, marginBottom: 14, lineHeight: 1.55,
        }}>
          You have used your full peer-evaluation allowance
          {quota.limit === 1 ? " (one student)" : ` (${quota.limit} students)`}.
          An administrator can increase this if your programme requires it.
        </div>
      )}

      {/* search */}
      {!quota?.reached && !blocked && (
        <Card style={{ marginBottom: 14 }}>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: .5, display: "block", marginBottom: 6 }}>
              Find a student
            </span>
            <input
              style={input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
            />
          </label>
          <p style={{ ...font, margin: "8px 0 0", fontSize: 11.5, color: C.muted }}>
            Students you have already evaluated are hidden — each student can be
            evaluated once.
          </p>
        </Card>
      )}

      {/* candidates */}
      {!quota?.reached && !blocked && (
        <Card pad={0} style={{ marginBottom: 16, overflow: "hidden" }}>
          {loading ? (
            <Empty>Loading students…</Empty>
          ) : candidates.length === 0 ? (
            <Empty>
              {debounced
                ? `No students match "${debounced}".`
                : "No students available to evaluate right now."}
            </Empty>
          ) : (
            candidates.map((c, i) => (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px",
                borderTop: i ? `1px solid ${C.ruleSoft}` : "none",
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: "#3B5BA51a", color: "#3B5BA5",
                  display: "grid", placeItems: "center", fontSize: 13.5, fontWeight: 700,
                }}>{c.name?.[0]?.toUpperCase() || "?"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.email}
                  </div>
                </div>
                <button onClick={() => setTarget(c)} style={{
                  ...font, background: C.teal, color: "#fff", border: `1px solid ${C.tealDeep}`,
                  padding: "7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                  cursor: "pointer", whiteSpace: "nowrap",
                }}>Evaluate</button>
              </div>
            ))
          )}
        </Card>
      )}

      {/* already evaluated */}
      {evaluated.length > 0 && (
        <>
          <h3 style={{
            ...font, margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: C.inkSoft,
            textTransform: "uppercase", letterSpacing: .6,
          }}>Already evaluated by you</h3>
          <Card pad={0} style={{ overflow: "hidden" }}>
            {evaluated.map((e, i) => (
              <div key={e.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 16px",
                borderTop: i ? `1px solid ${C.ruleSoft}` : "none", background: "#FCFBF8",
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: C.greenSoft, color: C.green,
                  display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700,
                }}>✓</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{e.name}</div>
                  <div style={{ fontSize: 11.5, color: C.muted }}>
                    {e.skills?.length ? e.skills.join(", ") : e.email}
                  </div>
                </div>
                <span style={{
                  ...font, fontSize: 11, fontWeight: 600, color: C.green,
                  background: C.greenSoft, padding: "3px 9px", borderRadius: 20,
                  border: `1px solid ${C.green}22`, whiteSpace: "nowrap",
                }}>Evaluated</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {target && (
        <ScoreModal
          student={target}
          onClose={() => setTarget(null)}
          onSubmit={submitScore}
        />
      )}

      {toast.msg && (
        <div style={{
          ...font, position: "fixed", bottom: 24, right: 24, zIndex: 2000,
          background: toast.kind === "error" ? C.red : C.tealDeep, color: "#fff",
          padding: "12px 18px", borderRadius: 10, fontSize: 13.5, fontWeight: 500,
          maxWidth: 400, boxShadow: "0 8px 26px rgba(0,0,0,.24)",
          display: "flex", gap: 10, alignItems: "center",
        }}>
          <span style={{ fontSize: 15 }}>{toast.kind === "error" ? "⚠" : "✓"}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ modal */
function ScoreModal({ student, onClose, onSubmit }) {
  const [skill, setSkill] = useState("");
  const [confidence, setConfidence] = useState(1);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function go() {
    if (!skill.trim()) return setErr("Please name the skill you are evaluating.");
    setErr("");
    setBusy(true);
    await onSubmit({ skill: skill.trim(), confidence, comment: comment.trim() });
    setBusy(false);
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(14,17,22,.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      backdropFilter: "blur(2px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.card, borderRadius: 14, width: "100%", maxWidth: 460,
        maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,.28)",
      }}>
        <div style={{
          padding: "16px 22px", borderBottom: `1px solid ${C.ruleSoft}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h3 style={{ ...font, margin: 0, fontSize: 16, fontWeight: 700, color: C.ink }}>
            Evaluate {student.name}
          </h3>
          <button onClick={onClose} style={{
            border: "none", background: "transparent", fontSize: 21, cursor: "pointer",
            color: C.muted, lineHeight: 1, padding: 0,
          }}>×</button>
        </div>

        <div style={{ padding: 22 }}>
          <div style={{
            background: C.goldSoft, border: `1px solid ${C.gold}44`, borderRadius: 9,
            padding: "10px 13px", marginBottom: 18, fontSize: 12.5,
            color: C.inkSoft, lineHeight: 1.55,
          }}>
            This uses part of your peer-evaluation allowance and <strong>cannot be
            undone</strong>. You will not be able to evaluate {student.name} again.
          </div>

          {err && (
            <div style={{
              background: C.redSoft, border: `1px solid ${C.red}55`, color: C.red,
              padding: "9px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 14, fontWeight: 500,
            }}>{err}</div>
          )}

          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ ...font, display: "block", fontSize: 12, fontWeight: 600, color: C.inkSoft, marginBottom: 5 }}>
              Skill <span style={{ color: C.red }}>*</span>
            </span>
            <input style={input} value={skill} onChange={(e) => setSkill(e.target.value)}
              placeholder="e.g. Java, SQL, Technical writing" autoFocus />
          </label>

          <div style={{ marginBottom: 16 }}>
            <span style={{ ...font, display: "block", fontSize: 12, fontWeight: 600, color: C.inkSoft, marginBottom: 7 }}>
              How do you know this? <span style={{ color: C.red }}>*</span>
            </span>
            {[
              { v: 1, label: "I have seen this first-hand", hint: "Worked with them directly — carries full weight" },
              { v: 2, label: "I am aware of it", hint: "Second-hand knowledge — carries half weight" },
            ].map((o) => (
              <label key={o.v} style={{
                display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer",
                padding: "9px 11px", borderRadius: 8, marginBottom: 7,
                border: `1px solid ${confidence === o.v ? C.teal : C.rule}`,
                background: confidence === o.v ? "#2D6E6A0d" : "transparent",
              }}>
                <input type="radio" checked={confidence === o.v} onChange={() => setConfidence(o.v)}
                  style={{ marginTop: 2, cursor: "pointer" }} />
                <span>
                  <span style={{ ...font, fontSize: 13, fontWeight: 600, color: C.ink, display: "block" }}>{o.label}</span>
                  <span style={{ ...font, fontSize: 11.5, color: C.muted }}>{o.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <label style={{ display: "block", marginBottom: 20 }}>
            <span style={{ ...font, display: "block", fontSize: 12, fontWeight: 600, color: C.inkSoft, marginBottom: 5 }}>
              Comment (optional)
            </span>
            <textarea style={{ ...input, minHeight: 74, resize: "vertical" }}
              value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="What did you observe?" />
          </label>

          <div style={{ display: "flex", gap: 9, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{
              ...font, background: "transparent", color: C.inkSoft,
              border: `1px solid ${C.rule}`, padding: "9px 16px", borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>Cancel</button>
            <button onClick={go} disabled={busy} style={{
              ...font, background: busy ? C.rule : C.teal, color: "#fff",
              border: `1px solid ${busy ? C.rule : C.tealDeep}`, padding: "9px 18px",
              borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
            }}>{busy ? "Submitting…" : "Submit evaluation"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ atoms */
function Card({ children, style, pad = 16 }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.ruleSoft}`, borderRadius: 12,
      padding: pad, boxShadow: "0 1px 3px rgba(14,17,22,.05)", ...style,
    }}>{children}</div>
  );
}

const Empty = ({ children }) => (
  <div style={{ ...font, padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>{children}</div>
);
