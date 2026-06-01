import { useState } from 'react'
import { useGrit } from '../../context/GritContext'
import { useAgent } from '../../hooks/useAgent'
import ResponseBox from '../common/ResponseBox'

export default function Forecaster({ onNavigate }) {
  const { state, dispatch } = useGrit()
  const { loading, response, run } = useAgent('FORECASTER')
  const [skills, setSkills] = useState('')
  const [region, setRegion] = useState('United States')

  // Pick up prefilled skills when pane becomes active
  const effectiveSkills = skills || state.prefillSkills || ''

  const handleRun = async () => {
    const s = effectiveSkills.trim()
    if (!s) { dispatch({ type: 'TOAST', payload: { msg: 'Enter skills to forecast', type: 'err' } }); return }
    const result = await run(
      'You are GRIT:FORECASTER — an expert labor market analyst with access to BLS, LinkedIn Economic Graph, and Burning Glass data.',
      `Forecast 24-month talent demand for:\nSkills: ${s}\nRegion: ${region}\n\nProvide:\n1. Hot Skills in High Demand (with growth % and visual bar)\n2. Emerging Skills to Acquire Now\n3. Market Saturation Warnings\n4. Salary Range Estimates by role\n5. Top Industries Hiring\n6. 6-Month Action Priority List`
    )
    if (result) dispatch({ type: 'MARK_DONE', payload: 1 })
  }

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="agent-tag">AGENT 02 · GRIT:FORECASTER</div>
          <h2>Talent Demand Forecaster<small>24-month market demand forecast for your skill set by region</small></h2>
        </div>
        <button className="btn btn-sec" onClick={() => onNavigate(2)}>Next: Curriculum →</button>
      </div>

      <div className="grid2">
        <div className="card">
          <label>Skills to Forecast <span style={{ color: 'var(--teal2)', fontWeight: 400 }}>(auto-filled from Translator)</span></label>
          <textarea
            value={skills || state.prefillSkills || ''}
            onChange={e => setSkills(e.target.value)}
            placeholder="e.g. Python, SQL, Machine Learning, React, AWS..."
            rows={5}
          />
          <label>Geographic Region</label>
          <select value={region} onChange={e => setRegion(e.target.value)}>
            <option>United States</option>
            <option>Southeast US (Georgia)</option>
            <option>New York Metro</option>
            <option>San Francisco Bay Area</option>
            <option>Austin TX</option>
            <option>Chicago IL</option>
            <option>Europe</option>
            <option>Global Remote</option>
          </select>
        </div>
        <div className="card">
          <div className="card-title">About This Agent</div>
          <div className="info-box">
            📊 Forecasts 24-month talent demand using labor market signals.<br /><br />
            <strong>Data modeled from:</strong><br />
            • Bureau of Labor Statistics Occupational Outlook<br />
            • LinkedIn Economic Graph job-posting trends<br />
            • Burning Glass Technologies skill-demand analytics<br />
            • Indeed salary benchmarks
          </div>
        </div>
      </div>

      <div className="card">
        <div className="run-row">
          <div className="card-title">📊 Demand Forecast</div>
          <button className="btn btn-primary" onClick={handleRun} disabled={loading}>
            {loading ? '⏳ Running…' : '▶ Run Forecaster'}
          </button>
        </div>
        <ResponseBox response={response} loading={loading}
          placeholder="Run Translator first to auto-fill skills, or enter them manually above." prose />
      </div>
    </div>
  )
}
