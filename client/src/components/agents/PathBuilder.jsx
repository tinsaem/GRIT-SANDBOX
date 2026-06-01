import { useState } from 'react'
import { useGrit } from '../../context/GritContext'
import { useAgent } from '../../hooks/useAgent'
import ResponseBox from '../common/ResponseBox'

export default function PathBuilder({ onNavigate }) {
  const { state, dispatch } = useGrit()
  const { loading, response, run } = useAgent('PATHBUILDER')
  const [role,        setRole]        = useState('')
  const [level,       setLevel]       = useState('intermediate')
  const [skills,      setSkills]      = useState('')
  const [constraints, setConstraints] = useState('')

  const handleRun = async () => {
    const r = (role || state.prefillRole || '').trim()
    if (!r) { dispatch({ type: 'TOAST', payload: { msg: 'Enter a target role', type: 'err' } }); return }
    const result = await run(
      'You are GRIT:PATHBUILDER — an AI learning path architect that creates hyper-personalized educational roadmaps.',
      `Build a learning path for:\nTarget Role: ${r}\nCurrent Level: ${level}\nExisting Skills: ${skills || state.prefillSkills || 'none'}\nConstraints: ${constraints || 'none'}\n\nProvide:\n1. Quick Wins (achievable in first 2 weeks)\n2. Week-by-Week 12-Week Roadmap (specific daily/weekly tasks)\n3. Decision Branches (IF X level THEN Y path)\n4. Milestone Checkpoints with self-assessment criteria\n5. Accountability System Recommendations\n6. Estimated Job-Application Readiness Date`
    )
    if (result) dispatch({ type: 'MARK_DONE', payload: 3 })
  }

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="agent-tag">AGENT 04 · GRIT:PATHBUILDER</div>
          <h2>Learning Path Builder<small>Your individualized week-by-week roadmap to job-readiness</small></h2>
        </div>
        <button className="btn btn-sec" onClick={() => onNavigate(4)}>Next: Generator →</button>
      </div>

      <div className="grid2">
        <div className="card">
          <label>Target Role <span style={{ color: 'var(--teal2)', fontWeight: 400 }}>(auto-filled)</span></label>
          <input type="text" value={role || state.prefillRole || ''} onChange={e => setRole(e.target.value)} placeholder="e.g. Data Scientist, Cloud Architect…" />

          <label>Current Skill Level</label>
          <select value={level} onChange={e => setLevel(e.target.value)}>
            <option value="beginner">Beginner — new to this field</option>
            <option value="intermediate">Intermediate — some experience</option>
            <option value="advanced">Advanced — career changer</option>
          </select>

          <label>Existing Skills <span style={{ color: 'var(--teal2)', fontWeight: 400 }}>(auto-filled)</span></label>
          <textarea value={skills || state.prefillSkills || ''} onChange={e => setSkills(e.target.value)} placeholder="Skills extracted from resume…" rows={3} />

          <label>Constraints (optional)</label>
          <input type="text" value={constraints} onChange={e => setConstraints(e.target.value)} placeholder="e.g. 15 hrs/week, no budget, full-time student…" />
        </div>
        <div className="card">
          <div className="card-title">About This Agent</div>
          <div className="info-box">
            🗺️ Builds a hyper-personalized 12-week roadmap with decision branches.<br /><br />
            Outputs: Quick wins (Weeks 1–2), week-by-week tasks, IF/THEN decision branches, milestone checkpoints, accountability system, and estimated job-application readiness date.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="run-row">
          <div className="card-title">🗺️ Learning Path</div>
          <button className="btn btn-primary" onClick={handleRun} disabled={loading}>
            {loading ? '⏳ Running…' : '▶ Run Path Builder'}
          </button>
        </div>
        <ResponseBox response={response} loading={loading}
          placeholder="Fill in your target role and current level, then run the agent." prose />
      </div>
    </div>
  )
}
