import { useState } from 'react'
import { useGrit, WEIGHTS, CAPS } from '../../context/GritContext'
import { useAgent } from '../../hooks/useAgent'
import ResponseBox from '../common/ResponseBox'
import StarRating from '../common/StarRating'
import { SKILL_KWS, classifyCIP, buildLeaderboard } from '../../lib/utils'

// ── Score card ──────────────────────────────────────────────────
function ScoreCard({ label, value }) {
  return (
    <div className="score-card">
      <div className="score-val">{value}</div>
      <div className="score-lbl">{label}</div>
      <div className="prog-wrap">
        <div className="prog" style={{ width: value + '%' }} />
      </div>
    </div>
  )
}

// ── Leaderboard (L1–L7 tabs) ────────────────────────────────────
function Leaderboard({ scores, name, privacy, lbLevel, onLevelChange, cip }) {
  const entries = buildLeaderboard(scores.comp, name, privacy, lbLevel)
  const LEVELS  = ['L1 Major','L2 Dept','L3 College','L4 Univ','L5 Region','L6 National','L7 Global']

  return (
    <div className="card">
      <div className="card-title" style={{ justifyContent: 'space-between' }}>
        <span>🏆 Leaderboard</span>
        {cip[0] !== '99' && (
          <span style={{ fontSize: 12, fontWeight: 400, color: '#7f8c8d' }}>
            <span className="cip-chip">CIP {cip[0]}</span> {cip[1]}
          </span>
        )}
      </div>
      <div className="lb-tabs">
        {LEVELS.map((lbl, i) => (
          <div key={i} className={`lb-tab${lbLevel === i ? ' active' : ''}`} onClick={() => onLevelChange(i)}>
            {lbl}
          </div>
        ))}
      </div>
      <table className="lb-table">
        <thead><tr><th>#</th><th>Name</th><th>Score</th><th>OEF</th></tr></thead>
        <tbody>
          {entries.map((r, i) => {
            const rc = i === 0 ? 'g' : i === 1 ? 's' : i === 2 ? 'b' : ''
            return (
              <tr key={i} className={r.you ? 'you' : ''}>
                <td><span className={`rank ${rc}`}>{i + 1}</span></td>
                <td>{r.n}{r.you ? ' 👈' : ''}</td>
                <td>{r.s}</td>
                <td>{Math.round(r.s * 8.2)} OEF</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: '#95a5a6', marginTop: 8, textAlign: 'right' }}>
        Simulated peers · Hedera HTS ID 0.0.8474598 · Mainnet pending
      </div>
    </div>
  )
}

// ── Step 1: View Resume panel (architecture §4.3) ───────────────
// Verifier reviews the student's resume and clicks a skill to select it for Step 2
function ViewResumePanel({ resume, verifiedSkills, onSelectSkill }) {
  const [expanded, setExpanded] = useState(false)
  const found = SKILL_KWS.filter(k => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(resume))

  return (
    <div className="card">
      <div className="card-title">
        📄 Step 1 · View Resume
        <span style={{ fontSize: 11, color: '#7f8c8d', fontWeight: 400, marginLeft: 6 }}>
          Click a skill tag to select it for verification
        </span>
      </div>
      <div className="card-sub">
        Review the student's skills and resume — click any skill below to auto-fill Step 2
      </div>

      {/* Skill tags — primary interface for selecting a skill */}
      <div className="skill-tags" style={{ marginBottom: 12 }}>
        {found.length
          ? found.map(k => {
              const ver = verifiedSkills.find(v => v.skill === k)
              return (
                <span
                  key={k}
                  className={`stag${ver ? ' ver' : ''}`}
                  onClick={() => onSelectSkill(k)}
                  title={ver ? `Already verified by ${ver.role}` : `Click to verify "${k}"`}
                >
                  {ver ? '✓ ' : ''}{k}
                </span>
              )
            })
          : <em style={{ color: '#95a5a6', fontSize: 12 }}>
              Run Agent 01 (Translator) first to extract skills from the resume
            </em>
        }
      </div>

      {/* Collapsible resume text preview */}
      {resume && (
        <>
          <div
            style={{ cursor: 'pointer', fontSize: 12, color: 'var(--teal2)', fontWeight: 600, marginBottom: 6 }}
            onClick={() => setExpanded(x => !x)}
          >
            {expanded ? '▲ Hide resume text' : '▼ Show full resume text'}
          </div>
          {expanded && (
            <div style={{
              background: '#f7f9fb', border: '1px solid var(--border)', borderRadius: 6,
              padding: 12, fontSize: 12, maxHeight: 220, overflow: 'auto',
              whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: '#2c3e50',
              lineHeight: 1.6
            }}>
              {resume}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Verify log ──────────────────────────────────────────────────
function VerifyLog({ entries }) {
  return (
    <div className="vlog">
      {!entries.length
        ? <div style={{ color: '#95a5a6', padding: '4px 8px' }}>No verifications yet</div>
        : entries.map((e, i) => (
            <div key={i} className={`ventry ${e.type}`}>
              [{new Date(e.ts).toLocaleTimeString()}] {e.msg}
            </div>
          ))
      }
    </div>
  )
}

// ── Main Reputation pane ────────────────────────────────────────
export default function Reputation() {
  const { state, dispatch } = useGrit()
  const { loading, response, run } = useAgent('REPUTATION')

  const [lbLevel,  setLbLevel]  = useState(0)
  const [skill,    setSkill]    = useState('')
  const [role,     setRole]     = useState('employer')
  const [stars,    setStars]    = useState(0)
  const [conf,     setConf]     = useState(80)
  const [comment,  setComment]  = useState('')

  const cip = classifyCIP(state.resume + ' ' + state.jd + ' ' + (state.major || ''))

  // Step 1 → Step 2: clicking a skill tag auto-fills the skill input
  const handleSelectSkill = (s) => {
    setSkill(s)
    // Scroll to Step 2
    document.getElementById('step2-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const handleRunAI = async () => {
    const skills = state.verifiedSkills.map(v => v.skill).join(', ') || 'No verified skills yet'
    const result = await run(
      'You are GRIT:REPUTATION — an AI talent verifier and career reputation advisor specializing in blockchain-anchored skill credentials.',
      `Analyze reputation profile for ${state.name || 'Student'}:\nVerified Skills: ${skills}\nReputation Score: ${state.scores.rep}/100\nVerification Score: ${state.scores.ver}/100\nComposite: ${state.scores.comp}/100\nOEF Tokens: ${state.tokens}\nHedera ID: ${state.hederaId || 'not set'}\n\nProvide:\n1. Reputation Tier (Bronze/Silver/Gold/Platinum) with score threshold\n2. Skill Portfolio Strengths\n3. Verification Strategy (which skills to verify next, in priority order)\n4. Career Signal Analysis (what recruiters will infer)\n5. OEF Token Optimization Tips (max earnings path)\n6. Next Steps to reach Gold Tier`
    )
    if (result) dispatch({ type: 'MARK_DONE', payload: 6 })
  }

  const handleVerify = () => {
    if (!skill.trim()) {
      dispatch({ type: 'TOAST', payload: { msg: 'Enter a skill to verify', type: 'err' } }); return
    }
    if (!stars) {
      dispatch({ type: 'TOAST', payload: { msg: 'Give a star rating', type: 'err' } }); return
    }
    if (state.verifiedSkills.find(v => v.skill === skill)) {
      dispatch({ type: 'TOAST', payload: { msg: `"${skill}" is already verified`, type: 'err' } }); return
    }
    if ((state.verifications[role] || 0) >= CAPS[role]) {
      dispatch({ type: 'TOAST', payload: { msg: `Max ${CAPS[role]} verifications as ${role} reached`, type: 'err' } }); return
    }

    const reward     = Math.round(100 * WEIGHTS[role] * (stars / 5))
    const newBalance = state.tokens + reward  // computed before dispatch to avoid stale state in toast

    dispatch({ type: 'VERIFY', payload: { skill, role, stars, conf, comment } })
    // Architecture §4.3 toast format: "✓ Submitted! +N OEF · Balance: M OEF"
    dispatch({ type: 'TOAST', payload: { msg: `✓ Submitted! +${reward} OEF · Balance: ${newBalance.toLocaleString()} OEF`, type: 'ok' } })

    setSkill(''); setStars(0); setConf(80); setComment('')
  }

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="agent-tag">AGENT 07 · GRIT:REPUTATION</div>
          <h2>Reputation Engine
            <small>Skill verification · OEF token ledger · L1–L7 leaderboard · CIP classification</small>
          </h2>
        </div>
        <button className="btn btn-primary" onClick={handleRunAI} disabled={loading}>
          {loading ? '⏳ Analyzing…' : '▶ AI Reputation Analysis'}
        </button>
      </div>

      {/* Score cards */}
      <div className="score-row">
        <ScoreCard label="Reputation Score"   value={state.scores.rep}  />
        <ScoreCard label="Verification Score" value={state.scores.ver}  />
        <ScoreCard label="Composite Score"    value={state.scores.comp} />
      </div>

      <div className="grid2">
        {/* Left: Leaderboard (with CIP badge) + AI analysis output */}
        <div>
          <Leaderboard
            scores={state.scores}
            name={state.name}
            privacy={state.privacy}
            lbLevel={lbLevel}
            onLevelChange={setLbLevel}
            cip={cip}
          />
          <div className="card">
            <div className="card-title">🤖 AI Reputation Analysis</div>
            <ResponseBox
              response={response}
              loading={loading}
              placeholder="Click <strong>AI Reputation Analysis</strong> above for a personalized tier assessment and OEF token optimization strategy."
              prose
            />
          </div>
        </div>

        {/* Right: Step 1 (View Resume) → Step 2 (Verify) → Log */}
        <div>
          {/* STEP 1 — View Resume panel (architecture §4.3 step 1) */}
          <ViewResumePanel
            resume={state.resume}
            verifiedSkills={state.verifiedSkills}
            onSelectSkill={handleSelectSkill}
          />

          {/* STEP 2 — Verification form (architecture §4.3 steps 2–end) */}
          <div className="card" id="step2-anchor">
            <div className="card-title">✅ Step 2 · Submit Verification</div>
            <div className="card-sub">
              Employers · Professors · Advisors · Peers — max 5 verifications per role
            </div>

            <label>Skill to Verify</label>
            <input
              type="text"
              value={skill}
              onChange={e => setSkill(e.target.value)}
              placeholder="e.g. Python, Data Analysis, Leadership… (or click a tag above)"
            />

            <label>Your Role as Verifier</label>
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="employer">Employer / Manager — 3× weight · up to 300 OEF/★</option>
              <option value="professor">Professor / Instructor — 2× weight</option>
              <option value="advisor">Academic Advisor — 1.5× weight</option>
              <option value="peer">Peer / Classmate — 1× weight</option>
            </select>

            <label>Star Rating</label>
            <StarRating value={stars} onChange={setStars} />

            <label>
              Confidence Level: <strong style={{ color: 'var(--teal2)' }}>{conf}%</strong>
            </label>
            <div className="slider-row">
              <input type="range" min={1} max={100} value={conf} onChange={e => setConf(+e.target.value)} />
              <div className="slider-val">{conf}%</div>
            </div>

            <label>Comment (optional)</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Briefly describe when/how you observed this skill…"
              rows={3}
            />

            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleVerify}>
                ⬡ Submit Verification
              </button>
              <button
                className="btn btn-sec"
                onClick={() => { setSkill(''); setStars(0); setConf(80); setComment('') }}
                title="Clear form"
              >✕</button>
            </div>

            {/* Live reward preview */}
            {skill && stars > 0 && (
              <div style={{
                marginTop: 10, padding: '8px 12px', background: '#f0faf7',
                border: '1px solid var(--teal)', borderRadius: 6,
                fontSize: 12, color: 'var(--teal2)', fontWeight: 600
              }}>
                ⬡ Estimated reward: +{Math.round(100 * WEIGHTS[role] * (stars / 5))} OEF
              </div>
            )}
          </div>

          {/* Verification log */}
          <div className="card">
            <div className="card-title">📋 Verification Log
              <span style={{ fontSize: 11, color: '#7f8c8d', fontWeight: 400, marginLeft: 6 }}>
                {state.verifiedSkills.length} verified · {state.tokens.toLocaleString()} OEF total
              </span>
            </div>
            <VerifyLog entries={state.verifyLog} />
          </div>
        </div>
      </div>
    </div>
  )
}
