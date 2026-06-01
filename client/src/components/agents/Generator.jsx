import { useState } from 'react'
import { useGrit } from '../../context/GritContext'
import { useAgent } from '../../hooks/useAgent'
import ResponseBox from '../common/ResponseBox'

function GanBar({ step }) {
  const cls = n => `gstep${n < step ? ' done' : n === step ? ' active' : ''}`
  return (
    <div className="gan-bar">
      <div className={cls(0)}>① Generate</div>
      <div className="garr">→</div>
      <div className={cls(1)}>② Discriminate</div>
      <div className="garr">→</div>
      <div className={cls(2)}>③ Equilibrium</div>
    </div>
  )
}

export default function Generator({ onNavigate }) {
  const { state, dispatch } = useGrit()
  const { loading, response, run } = useAgent('GENERATOR')
  const [domain, setDomain] = useState('')
  const [type,   setType]   = useState('product')
  const [step,   setStep]   = useState(0)

  const effectiveDomain = domain ||
    (state.prefillDomain ? `${state.prefillDomain} innovation${state.company ? ' at ' + state.company : ''}` : '')

  const handleRun = async () => {
    const d = effectiveDomain.trim()
    if (!d) { dispatch({ type: 'TOAST', payload: { msg: 'Enter a domain / problem space', type: 'err' } }); return }
    setStep(1)
    const result = await run(
      'You are GRIT:GENERATOR — the Generator half of a GAN metaphor. Propose bold, creative, disruptive innovations without self-censorship. Think like a visionary inventor.',
      `Generate 3 innovative ${type} ideas for: ${d}\n\nFor each innovation:\n1. Name + Elevator Pitch (2 sentences)\n2. Core Technology / Mechanism\n3. Target Users and Use Case\n4. Competitive Advantage\n5. Potential Impact (quantified if possible)\n6. Implementation Complexity (1–10)\n7. Revenue Model\n\nBe ambitious — the Discriminator critiques next.`
    )
    if (result) {
      // Bridge to discriminator
      dispatch({ type: 'SET', payload: { discInput: result.text.replace(/🔦 DEMO MODE\n─+\n\n/, '') } })
      dispatch({ type: 'MARK_DONE', payload: 4 })
      setStep(1)
    }
  }

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="agent-tag">AGENT 05 · GRIT:GENERATOR</div>
          <h2>
            Innovation Generator{' '}
            <span style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 600 }}>GAN ①</span>
            <small>Propose bold innovations — the Discriminator critiques next</small>
          </h2>
        </div>
        <button className="btn btn-sec" onClick={() => onNavigate(5)}>Next: Discriminator →</button>
      </div>

      <GanBar step={step} />

      <div className="grid2">
        <div className="card">
          <label>Domain / Problem Space <span style={{ color: 'var(--teal2)', fontWeight: 400 }}>(auto-filled from JD)</span></label>
          <textarea
            value={domain || effectiveDomain}
            onChange={e => setDomain(e.target.value)}
            placeholder="e.g. EdTech at KSU · AI-powered career services · Healthcare data interoperability…"
            rows={4}
          />
          <label>Innovation Type</label>
          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="product">Product / Feature</option>
            <option value="process">Process / Workflow</option>
            <option value="business model">Business Model</option>
            <option value="technology">Technology / Platform</option>
            <option value="social impact">Social Impact Initiative</option>
          </select>
        </div>
        <div className="card">
          <div className="card-title">About This Agent</div>
          <div className="info-box">
            💡 Plays the <strong>Generator</strong> role in a GAN metaphor — proposes 3 creative, potentially disruptive innovations without self-censorship.<br /><br />
            Output auto-fills the <strong>Discriminator (Agent 06)</strong> input for critique. Run both for a full GAN cycle.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="run-row">
          <div className="card-title">💡 Innovation Proposals</div>
          <button className="btn btn-primary" onClick={handleRun} disabled={loading}>
            {loading ? '⏳ Running…' : '▶ Run Generator'}
          </button>
        </div>
        <ResponseBox response={response} loading={loading}
          placeholder="Enter a domain above and run the Generator. Output will auto-fill the Discriminator." prose />
      </div>
    </div>
  )
}
