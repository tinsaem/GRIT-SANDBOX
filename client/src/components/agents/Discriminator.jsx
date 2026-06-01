import { useState } from 'react'
import { useGrit } from '../../context/GritContext'
import { useAgent } from '../../hooks/useAgent'
import ResponseBox from '../common/ResponseBox'

function GanBar() {
  return (
    <div className="gan-bar">
      <div className="gstep done">① Generate</div>
      <div className="garr">→</div>
      <div className="gstep active">② Discriminate</div>
      <div className="garr">→</div>
      <div className="gstep">③ Equilibrium</div>
    </div>
  )
}

export default function Discriminator({ onNavigate }) {
  const { state, dispatch } = useGrit()
  const { loading, response, run } = useAgent('DISCRIMINATOR')
  const [localInput, setLocalInput] = useState('')
  const [criteria, setCriteria]     = useState('feasibility, market viability, technical risk, ethical impact')

  const input = localInput || state.discInput || ''

  const handleRun = async () => {
    if (!input.trim()) {
      dispatch({ type: 'TOAST', payload: { msg: 'Run Generator first (Agent 05)', type: 'err' } })
      return
    }
    const result = await run(
      'You are GRIT:DISCRIMINATOR — the Discriminator half of a GAN. Rigorously critique innovations for feasibility, market viability, technical risk, and ethical implications. Be constructive but unsparing.',
      `Critically evaluate these proposals:\n\n${input}\n\nEvaluate each on: ${criteria}\nFor each:\n1. Score (1–10) with justification per criterion\n2. Critical Weaknesses (be specific)\n3. Recommended Pivot or Refinement\n4. Verdict: Accept / Revise / Reject\n\nEnd with a Final Ranking and recommendation for which to pursue.`
    )
    if (result) dispatch({ type: 'MARK_DONE', payload: 5 })
  }

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="agent-tag">AGENT 06 · GRIT:DISCRIMINATOR</div>
          <h2>
            Innovation Discriminator{' '}
            <span style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600 }}>GAN ②</span>
            <small>Rigorously critique Generator proposals — feasibility, market, ethics</small>
          </h2>
        </div>
        <button className="btn btn-sec" onClick={() => onNavigate(6)}>Next: Reputation →</button>
      </div>

      <GanBar />

      <div className="card">
        <label>
          Innovation Proposals to Critique{' '}
          <span style={{ color: 'var(--teal2)', fontWeight: 400 }}>(auto-filled from Generator)</span>
        </label>
        <textarea
          value={input}
          onChange={e => setLocalInput(e.target.value)}
          placeholder="Paste or auto-fill Generator output here…"
          rows={8}
        />
        <label>Evaluation Criteria</label>
        <select value={criteria} onChange={e => setCriteria(e.target.value)}>
          <option value="feasibility, market viability, technical risk, ethical impact">All criteria (recommended)</option>
          <option value="technical feasibility and implementation complexity">Technical feasibility focus</option>
          <option value="market size, competitive landscape, revenue model">Market / business focus</option>
          <option value="ethical implications, societal impact, equity">Ethics / impact focus</option>
        </select>
      </div>

      <div className="card">
        <div className="run-row">
          <div className="card-title">⚖️ Discriminator Critique</div>
          <button className="btn btn-primary" onClick={handleRun} disabled={loading}>
            {loading ? '⏳ Running…' : '▶ Run Discriminator'}
          </button>
        </div>
        <ResponseBox response={response} loading={loading}
          placeholder="Run the Generator first (Agent 05) — output auto-fills above. Then run Discriminator for a full GAN cycle." prose />
      </div>
    </div>
  )
}
