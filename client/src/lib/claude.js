import { DEMO_RESPONSES } from './demoResponses'

export async function callClaude(system, user, agentKey) {
  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 4000,
        system,
        messages: [{ role: 'user', content: user }]
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    return { text: data.content[0].text, demo: false }
  } catch {
    const demo = DEMO_RESPONSES[agentKey]
    if (demo) return { text: `🔦 DEMO MODE\n${'─'.repeat(44)}\n\n${demo}`, demo: true }
    throw new Error('API unavailable and no demo response for ' + agentKey)
  }
}
