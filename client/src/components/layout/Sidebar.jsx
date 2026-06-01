import { Fragment } from 'react'
import { useGrit } from '../../context/GritContext'

const AGENTS = [
  { num: '01', label: 'Translator' },
  { num: '02', label: 'Forecaster' },
  { num: '03', label: 'Curriculum' },
  { num: '04', label: 'Path Builder' },
  { num: '05', label: 'Generator' },
  { num: '06', label: 'Discriminator' },
  { num: '07', label: 'Reputation' },
]

export default function Sidebar() {
  const { state, dispatch } = useGrit()

  return (
    <nav>
      <div className="nav-lbl">7 Agents</div>
      {AGENTS.map(({ num, label }, i) => (
        <Fragment key={i}>
          {i === 6 && <div className="nav-sep" />}
          <div
            className={`nav-item${state.currentPane === i ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'NAVIGATE', payload: i })}
          >
            <div className={`nav-dot${(state.armed[i] || state.agents[i]) ? ' ready' : ''}`} />
            <span className="nav-num">{num}</span>
            {label}
          </div>
        </Fragment>
      ))}
    </nav>
  )
}
