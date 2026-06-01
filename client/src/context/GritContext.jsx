import { createContext, useContext, useReducer, useEffect } from 'react'

export const WEIGHTS = { employer: 3, professor: 2, advisor: 1.5, peer: 1 }
export const CAPS    = { employer: 5, professor: 5, advisor: 5, peer: 5 }

export function calcScores(verifiedSkills) {
  if (!verifiedSkills.length) return { rep: 0, ver: 0, comp: 0 }
  const totW     = verifiedSkills.reduce((s, v) => s + WEIGHTS[v.role], 0)
  const maxW     = verifiedSkills.length * WEIGHTS.employer
  const avgStars = verifiedSkills.reduce((s, v) => s + v.stars, 0) / verifiedSkills.length
  const avgConf  = verifiedSkills.reduce((s, v) => s + v.conf,  0) / verifiedSkills.length
  const rep  = Math.min(100, Math.round((totW / Math.max(maxW, 1)) * 85 * (verifiedSkills.length / Math.max(verifiedSkills.length + 2, 4)) * 1.2))
  const ver  = Math.min(100, Math.round(avgStars / 5 * 60 + avgConf / 100 * 40))
  const comp = Math.round(rep * 0.6 + ver * 0.4)
  return { rep, ver, comp }
}

const INITIAL = {
  // resume data
  resume: '', jd: '', company: '',
  // prefill fields (populated by Translator, consumed by agents 02–07)
  prefillSkills: '', prefillRole: '', prefillDomain: '',
  // account
  name: '', email: '', role: 'student', major: '', hederaId: '', privacy: 'public',
  // token ledger
  tokens: 0,
  // reputation
  verifiedSkills: [],
  verifications: { employer: 0, professor: 0, advisor: 0, peer: 0 },
  scores: { rep: 0, ver: 0, comp: 0 },
  verifyLog: [],
  // agent state
  // agents[i] = true when agent i has been *run* (dot bright + counted)
  // armed[i]  = true when agent i has been *prefilled* (dot teal, not yet run)
  agents: [false, false, false, false, false, false, false],
  armed:  [false, false, false, false, false, false, false],
  currentPane: 0,
  // GAN bridge
  discInput: '',
  // UI
  toast: null,
  modalOpen: false,
  lbLevel: 0,
}

function reducer(state, { type, payload }) {
  switch (type) {
    case 'SET':
      return { ...state, ...payload }

    case 'NAVIGATE':
      return { ...state, currentPane: payload }

    case 'MARK_DONE': {
      const agents = [...state.agents]
      agents[payload] = true
      return { ...state, agents }
    }

    case 'PREFILL': {
      const { resume, jd, company, prefillSkills, prefillRole, prefillDomain } = payload
      // arm agents 02–07 (indices 1–6) so their sidebar dots turn teal
      const armed = [false, true, true, true, true, true, true]
      return {
        ...state,
        resume, jd, company,
        prefillSkills: prefillSkills || '',
        prefillRole:   prefillRole   || '',
        prefillDomain: prefillDomain || '',
        armed,
      }
    }

    case 'VERIFY': {
      const { skill, role, stars, conf, comment } = payload
      const reward = Math.round(100 * WEIGHTS[role] * (stars / 5))
      const verifiedSkills = [...state.verifiedSkills, { skill, role, stars, conf, comment, ts: Date.now() }]
      const verifications  = { ...state.verifications, [role]: (state.verifications[role] || 0) + 1 }
      const tokens = state.tokens + reward
      const scores = calcScores(verifiedSkills)
      const entry  = { msg: `✓ ${skill} — ${role} (${stars}★, ${conf}% conf) +${reward} OEF`, type: 'ok', ts: Date.now() }
      return { ...state, verifiedSkills, verifications, tokens, scores, verifyLog: [entry, ...state.verifyLog] }
    }

    case 'TOAST':
      return { ...state, toast: payload }

    case 'CLEAR_TOAST':
      return { ...state, toast: null }

    case 'OPEN_MODAL':
      return { ...state, modalOpen: true }

    case 'CLOSE_MODAL':
      return { ...state, modalOpen: false }

    default:
      return state
  }
}

const GritContext = createContext()

export function GritProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL)

  // Restore account from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('grit-acct')
      if (saved) {
        const a = JSON.parse(saved)
        dispatch({ type: 'SET', payload: { name: a.name, email: a.email, role: a.role, major: a.major, hederaId: a.hederaId, privacy: a.privacy } })
      }
    } catch {}
  }, [])

  // Save account on change
  useEffect(() => {
    try {
      sessionStorage.setItem('grit-acct', JSON.stringify({
        name: state.name, email: state.email, role: state.role,
        major: state.major, hederaId: state.hederaId, privacy: state.privacy
      }))
    } catch {}
  }, [state.name, state.email, state.role, state.major, state.hederaId, state.privacy])

  return (
    <GritContext.Provider value={{ state, dispatch }}>
      {children}
    </GritContext.Provider>
  )
}

export function useGrit() {
  return useContext(GritContext)
}
