import { useState } from 'react'
import { callClaude } from '../lib/claude'
import { useGrit } from '../context/GritContext'

export function useAgent(agentKey) {
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState(null)
  const { dispatch } = useGrit()

  const run = async (system, user) => {
    setLoading(true)
    setResponse(null)
    try {
      const result = await callClaude(system, user, agentKey)
      setResponse(result)
      return result
    } catch (e) {
      dispatch({ type: 'TOAST', payload: { msg: 'Error: ' + e.message, type: 'err' } })
      return null
    } finally {
      setLoading(false)
    }
  }

  return { loading, response, run }
}
