import { useEffect, useRef } from 'react'
import { useGrit } from '../../context/GritContext'

export default function Toast() {
  const { state, dispatch } = useGrit()
  const timerRef = useRef()

  useEffect(() => {
    if (state.toast) {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 3500)
    }
    return () => clearTimeout(timerRef.current)
  }, [state.toast, dispatch])

  return (
    <div className={`toast${state.toast ? ' show' : ''}${state.toast ? ' ' + (state.toast.type || '') : ''}`}>
      {state.toast?.msg}
    </div>
  )
}
