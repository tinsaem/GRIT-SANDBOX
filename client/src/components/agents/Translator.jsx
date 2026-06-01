import { useState } from 'react'
import { useGrit } from '../../context/GritContext'
import { useAgent } from '../../hooks/useAgent'
import UploadFactory from '../common/UploadFactory'
import ResponseBox from '../common/ResponseBox'
import { detectCo, extractSkills, extractRole, extractDomain } from '../../lib/utils'

export default function Translator({ onNavigate }) {
  const { dispatch } = useGrit()
  const { loading, response, run } = useAgent('TRANSLATOR')
  const [resume, setResume] = useState('')
  const [jd, setJd]         = useState('')

  const handleRun = async () => {
    if (!resume.trim()) { dispatch({ type: 'TOAST', payload: { msg: 'Add your resume first', type: 'err' } }); return }
    if (!jd.trim())     { dispatch({ type: 'TOAST', payload: { msg: 'Add the job description first', type: 'err' } }); return }

    const company = detectCo(jd)
    const result  = await run(
      `You are GRIT:TRANSLATOR — an expert career coach and resume strategist. Translate the student's resume into market-aligned language that matches the job description. Be specific, actionable, and use industry keywords.`,
      `RESUME:\n${resume}\n\nJOB DESCRIPTION:\n${jd}${company ? '\n\nTarget Company: ' + company : ''}\n\nProvide:\n1. Market-Aligned Skills Summary (reframed from resume language)\n2. Key Strengths That Match This Role\n3. Skill Gaps Identified\n4. Suggested Bullet-Point Rewrites (show before/after)\n5. ATS Keywords to Add`
    )

    if (result) {
      const prefillSkills = extractSkills(resume)
      const prefillRole   = extractRole(jd)
      const prefillDomain = extractDomain(jd)
      // Single PREFILL dispatch — stores data + arms agents 02–07 sidebar dots
      dispatch({ type: 'PREFILL', payload: { resume, jd, company, prefillSkills, prefillRole, prefillDomain } })
      dispatch({ type: 'MARK_DONE', payload: 0 })
      dispatch({ type: 'TOAST', payload: { msg: `✓ Prefilled all agents${company ? ' · ' + company : ''}  ●  Run any agent →`, type: 'ok' } })
    }
  }

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="agent-tag">AGENT 01 · GRIT:TRANSLATOR</div>
          <h2>Resume Translator<small>Translate your resume into market language aligned to a target job description</small></h2>
        </div>
        <button className="btn btn-sec" onClick={() => onNavigate(1)}>Next: Forecaster →</button>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-title">📄 Your Resume</div>
          <div className="card-sub">Upload .docx / .txt or paste below — stays in your browser</div>
          <UploadFactory onChange={setResume} />
          <label>Resume Text</label>
          <textarea value={resume} onChange={e => setResume(e.target.value)} placeholder="Or paste your resume here..." rows={8} />
        </div>
        <div className="card">
          <div className="card-title">💼 Job Description</div>
          <div className="card-sub">Upload or paste the target JD — company name auto-detected</div>
          <UploadFactory onChange={setJd} />
          <label>Job Description Text</label>
          <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Or paste the job description here..." rows={8} />
        </div>
      </div>

      <div className="card">
        <div className="run-row">
          <div className="card-title">🤖 Translator Output
            <span style={{ fontSize: 11, color: '#7f8c8d', fontWeight: 400, marginLeft: 6 }}>
              Runs first · auto-populates Agents 02–07
            </span>
          </div>
          <button className="btn btn-primary" onClick={handleRun} disabled={loading}>
            {loading ? '⏳ Running…' : '▶ Run Translator'}
          </button>
        </div>
        <ResponseBox response={response} loading={loading}
          placeholder="Upload resume and JD above, then click <strong>Run Translator</strong>. Output auto-prefills Agents 02–07." prose />
      </div>
    </div>
  )
}
