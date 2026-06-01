import { useState } from 'react'
import { useGrit } from '../../context/GritContext'
import { useAgent } from '../../hooks/useAgent'
import ResponseBox from '../common/ResponseBox'

export default function Curriculum({ onNavigate }) {
  const { state, dispatch } = useGrit()
  const { loading, response, run } = useAgent('CURRICULUM')
  const [role,     setRole]     = useState('')
  const [skills,   setSkills]   = useState('')
  const [timeline, setTimeline] = useState('6 months')

  const handleRun = async () => {
    const r = (role || state.prefillRole || '').trim()
    if (!r) { dispatch({ type: 'TOAST', payload: { msg: 'Enter a target role', type: 'err' } }); return }
    const s = skills || state.prefillSkills || 'entry-level'
    const result = await run(
      'You are GRIT:CURRICULUM — an expert instructional designer and career educator.',
      `Design a curriculum to prepare a student for: ${r}\nCurrent skills: ${s}\nTimeline: ${timeline}\n\nInclude:\n1. Learning Objectives (3-5 measurable outcomes)\n2. Module Breakdown (title, topics, hours per module)\n3. Recommended Resources (courses, books, certifications)\n4. Portfolio Projects (2-3 specific employer-impressive projects)\n5. Assessment Milestones\n6. Weekly Time Investment`
    )
    if (result) dispatch({ type: 'MARK_DONE', payload: 2 })
  }

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="agent-tag">AGENT 03 · GRIT:CURRICULUM</div>
          <h2>Curriculum Designer<small>Generate a structured curriculum with modules, resources, and projects</small></h2>
        </div>
        <button className="btn btn-sec" onClick={() => onNavigate(3)}>Next: Path Builder →</button>
      </div>

      <div className="grid2">
        <div className="card">
          <label>Target Role <span style={{ color: 'var(--teal2)', fontWeight: 400 }}>(auto-filled)</span></label>
          <input type="text" value={role || state.prefillRole || ''} onChange={e => setRole(e.target.value)} placeholder="e.g. Data Engineer, ML Engineer, Product Manager…" />

          <label>Existing Skill Set <span style={{ color: 'var(--teal2)', fontWeight: 400 }}>(auto-filled)</span></label>
          <textarea value={skills || state.prefillSkills || ''} onChange={e => setSkills(e.target.value)} placeholder="Skills from resume…" rows={4} />

          <label>Learning Timeline</label>
          <select value={timeline} onChange={e => setTimeline(e.target.value)}>
            <option value="3 months">3 months (intensive)</option>
            <option value="6 months">6 months (standard)</option>
            <option value="12 months">12 months (balanced)</option>
            <option value="18 months">18 months (part-time)</option>
          </select>
        </div>
        <div className="card">
          <div className="card-title">About This Agent</div>
          <div className="info-box">
            🎓 Designs a competency-based curriculum tailored to the skill gap between current state and target role.<br /><br />
            Outputs: Learning objectives, module breakdown with hours, recommended resources (courses, books, certs), portfolio projects, and weekly time investment estimate.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="run-row">
          <div className="card-title">📚 Curriculum Design</div>
          <button className="btn btn-primary" onClick={handleRun} disabled={loading}>
            {loading ? '⏳ Running…' : '▶ Run Curriculum Designer'}
          </button>
        </div>
        <ResponseBox response={response} loading={loading}
          placeholder="Enter target role and current skills above, then run the agent." prose />
      </div>
    </div>
  )
}
