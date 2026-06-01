import { useState, useRef } from 'react'
import mammoth from 'mammoth'

export default function UploadFactory({ onChange }) {
  const [filename, setFilename] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  const processFile = async (file) => {
    setFilename(`⏳ ${file.name}`)
    try {
      let text
      if (file.name.toLowerCase().endsWith('.docx')) {
        const ab = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer: ab })
        text = result.value
      } else {
        text = await file.text()
      }
      onChange(text)
      setFilename(`✓ ${file.name}`)
    } catch {
      setFilename('✗ Error reading file')
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      onChange(text)
      setFilename('✓ Pasted from clipboard')
    } catch {
      setFilename('Paste manually with Ctrl+V in the textarea')
    }
  }

  const handleClear = () => {
    onChange('')
    setFilename('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="uf-wrap">
      <div
        className={`uf-drop${dragging ? ' drag-over' : ''}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault(); setDragging(false)
          if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0])
        }}
      >
        <div className="uf-icon">📄</div>
        <div>Drop .docx / .txt here</div>
      </div>
      <div className="uf-actions">
        <button type="button" className="uf-btn" onClick={() => fileRef.current?.click()}>Browse</button>
        <button type="button" className="uf-btn" onClick={handlePaste}>📋 Paste</button>
        <button type="button" className="uf-btn clr" onClick={handleClear}>✕ Clear</button>
      </div>
      <div className="uf-name">{filename}</div>
      <input
        type="file"
        ref={fileRef}
        accept=".docx,.txt"
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) processFile(e.target.files[0]) }}
      />
    </div>
  )
}
