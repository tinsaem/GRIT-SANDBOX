import { useGrit } from '../../context/GritContext'
import { buildLeaderboard } from '../../lib/utils'

export default function Header() {
  const { state, dispatch } = useGrit()
  const agentsDone = state.agents.filter(Boolean).length
  const entries = buildLeaderboard(state.scores.comp, state.name, state.privacy, state.lbLevel || 0)
  const myRank  = entries.findIndex(e => e.you)

  return (
    <header>
      <div className="logo">GRIT <span>Sandbox v17</span></div>

      <div className="hstats">
        <div className="hstat">
          <strong>{state.verifiedSkills.length}</strong>
          Verified
        </div>
        <div className="hstat">
          <strong>{agentsDone}/7</strong>
          Agents
        </div>
        <div className="hstat">
          <strong>{myRank >= 0 ? `#${myRank + 1}` : '—'}</strong>
          L1 Rank
        </div>
      </div>

      <div className="token-pill">⬡ {state.tokens.toLocaleString()} OEF</div>
      <button className="btn-acct" onClick={() => dispatch({ type: 'OPEN_MODAL' })}>
        👤 {state.name ? state.name.split(' ')[0] : 'Account'}
      </button>
    </header>
  )
}
