export default function ResponseBox({ response, loading, placeholder, prose = false }) {
  if (loading) {
    return (
      <div className="res loading">
        <div className="spin" />
        Agent is thinking…
      </div>
    )
  }
  if (!response) {
    return (
      <div className={`res${prose ? ' prose' : ''}`}
        dangerouslySetInnerHTML={{ __html: placeholder }} />
    )
  }
  return (
    <div className={`res${response.demo ? ' demo' : ''}${prose ? ' prose' : ''}`}>
      {response.text}
    </div>
  )
}
