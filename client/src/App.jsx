import { Component } from 'react'
import { GritProvider, useGrit } from './context/GritContext'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import Toast from './components/common/Toast'
import AccountModal from './components/modals/AccountModal'
import Translator from './components/agents/Translator'
import Forecaster from './components/agents/Forecaster'
import Curriculum from './components/agents/Curriculum'
import PathBuilder from './components/agents/PathBuilder'
import Generator from './components/agents/Generator'
import Discriminator from './components/agents/Discriminator'
import Reputation from './components/agents/Reputation'

const PANES = [Translator, Forecaster, Curriculum, PathBuilder, Generator, Discriminator, Reputation]

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: 'monospace', color: '#c0392b', background: '#fff5f5', minHeight: '100vh' }}>
        <h2>⚠ GRIT App Error</h2>
        <pre style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontSize: 13 }}>{String(this.state.error)}</pre>
        <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 11, color: '#888' }}>{this.state.error?.stack}</pre>
        <p style={{ marginTop: 16 }}>Open browser DevTools → Console for more detail.</p>
      </div>
    )
    return this.props.children
  }
}

function AppInner() {
  const { state, dispatch } = useGrit()
  const navigate = (n) => dispatch({ type: 'NAVIGATE', payload: n })

  return (
    <>
      <Header />
      <div className="layout">
        <Sidebar />
        <main>
          {PANES.map((Pane, i) => (
            <div key={i} style={{ display: state.currentPane === i ? 'block' : 'none' }}>
              <Pane onNavigate={navigate} />
            </div>
          ))}
        </main>
      </div>
      <AccountModal />
      <Toast />
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <GritProvider>
        <AppInner />
      </GritProvider>
    </ErrorBoundary>
  )
}
