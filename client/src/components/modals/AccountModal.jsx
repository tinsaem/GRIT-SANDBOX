import { useState, useEffect } from 'react'
import { useGrit } from '../../context/GritContext'

function genHederaId() {
  return `0.0.${Math.floor(Math.random() * 9000000) + 1000000}`
}

export default function AccountModal() {
  const { state, dispatch } = useGrit()
  const [form, setForm] = useState({
    name: '', email: '', role: 'student', major: '', privacy: 'public', hederaId: ''
  })

  useEffect(() => {
    if (state.modalOpen) {
      setForm({
        name:     state.name,
        email:    state.email,
        role:     state.role,
        major:    state.major,
        privacy:  state.privacy,
        hederaId: state.hederaId || ''
      })
    }
  }, [state.modalOpen])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGenerate = () => set('hederaId', genHederaId())

  const handleSave = () => {
    const id = form.hederaId || genHederaId()
    dispatch({ type: 'SET', payload: { ...form, hederaId: id } })
    dispatch({ type: 'CLOSE_MODAL' })
    dispatch({ type: 'TOAST', payload: { msg: `✓ Account saved · ${id}`, type: 'ok' } })
  }

  const handleReset = () => {
    setForm({ name: '', email: '', role: 'student', major: '', privacy: 'public', hederaId: '' })
    dispatch({ type: 'SET', payload: {
      resume: '', jd: '', company: '',
      prefillSkills: '', prefillRole: '', prefillDomain: '',
      armed: [false, false, false, false, false, false, false]
    }})
    dispatch({ type: 'TOAST', payload: { msg: '✓ New Major Search started', type: 'ok' } })
  }

  if (!state.modalOpen) return null

  return (
    <div
      className="overlay open"
      onClick={e => { if (e.target === e.currentTarget) dispatch({ type: 'CLOSE_MODAL' }) }}
    >
      <div className="modal">
        <div className="modal-title">👤 Account Setup</div>
        <div className="modal-sub">Your profile · Hedera identity · Privacy settings</div>

        <label>Full Name</label>
        <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Jane Smith" />

        <label>Email</label>
        <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="your@ksu.edu" />

        <label>Role</label>
        <select value={form.role} onChange={e => set('role', e.target.value)}>
          <option value="student">Student</option>
          <option value="recent-grad">Recent Graduate</option>
          <option value="professional">Working Professional</option>
          <option value="faculty">Faculty / Staff</option>
        </select>

        <label>Major / Field of Study</label>
        <input type="text" value={form.major} onChange={e => set('major', e.target.value)} placeholder="e.g. Computer Science, Data Science, MBA..." />

        <label>Leaderboard Privacy</label>
        <select value={form.privacy} onChange={e => set('privacy', e.target.value)}>
          <option value="public">Public (show full name)</option>
          <option value="anonymous">Anonymous (initials only)</option>
          <option value="hidden">Hidden (exclude from leaderboard)</option>
        </select>

        <label>Hedera Wallet ID</label>
        <div className="hedera-id">{form.hederaId || 'Not yet assigned'}</div>
        <button className="uf-btn" style={{ marginTop: 8 }} onClick={handleGenerate}>
          🔄 Generate Hedera ID
        </button>
        <div className="privacy-note">⚠ Simulated in v17 · Real @hashgraph/sdk integration planned for v18</div>

        <div className="modal-foot">
          <button className="btn btn-sec" onClick={handleReset}>🔄 New Major Search</button>
          <button className="btn btn-sec" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Account</button>
        </div>
      </div>
    </div>
  )
}
