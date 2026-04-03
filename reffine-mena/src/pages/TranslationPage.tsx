import { useState, useRef, useCallback } from 'react'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'
import { useAdmin, useTheme } from '../store'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

const LANG_NAMES: Record<string, string> = {
  en: 'EN — English', ar: 'AR — Arabic', fr: 'FR — French',
  az: 'AZ — Azerbaijani', ka: 'GE — Georgian', kk: 'KZ — Kazakh',
  ru: 'RU — Russian', hy: 'AM — Armenian', 'ku-ckb': 'KU — Kurdish (Sorani)'
}
const RTL = new Set(['ar', 'ku-ckb'])
const GROQ_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.3-70b-versatile',
  'llama3-70b-8192',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
]
const BATCH = 30

async function callGroq(content: string, fromLang: string, toLang: string, batch: boolean, key: string): Promise<string> {
  const system = `You are a professional brand localisation expert for Modern Luxury automotive. Translate from ${fromLang} to ${toLang}. Preserve HTML tags. Do not translate proper nouns (Range Rover, Jaguar, Land Rover, SV, Kvadrat). Use elegant, refined tone.`
  const user = batch
    ? `INPUT is a JSON array. OUTPUT must be ONLY a valid JSON array of translated strings in exact order. No markdown, no explanation.\n\n${content}`
    : `OUTPUT must be ONLY the translated text. No preamble.\n\n${content}`

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.2, max_tokens: 8192 })
      })
      const json = await res.json()
      if (res.status === 401) throw new Error('INVALID_KEY')
      if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`)
      const result = json.choices?.[0]?.message?.content
      if (result) return result.trim()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'INVALID_KEY') throw new Error('Invalid Groq API key — update it in the Admin panel.')
      console.warn('Model failed:', model, e)
    }
  }
  throw new Error('Translation failed — all models unavailable. Check your Groq API key in Admin panel.')
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Translator (Text + Documents sub-tabs)
// ─────────────────────────────────────────────────────────────────────────────
function AITranslator() {
  const { config } = useAdmin()
  const [mode, setMode] = useState<'text' | 'doc'>('text')
  const [srcLang, setSrcLang] = useState('en')
  const [tgtLang, setTgtLang] = useState('ru')
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // Doc mode
  const [file, setFile] = useState<File | null>(null)
  const [fileRows, setFileRows] = useState<number>(0)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [doneMsg, setDoneMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const translatedDataRef = useRef<any[][]>([])
  const wbRef = useRef<any>(null)
  const sheetNameRef = useRef('')
  const fileTypeRef = useRef<'csv' | 'xlsx'>('csv')
  const isPhrases = useRef(false)

  const groqKey = config.groqKey
  const fromName = LANG_NAMES[srcLang] || srcLang
  const toName = LANG_NAMES[tgtLang] || tgtLang

  async function translate() {
    if (!inputText.trim()) return
    if (!groqKey) { setError('No Groq API key. Set it in Admin panel.'); return }
    setTranslating(true); setError(''); setOutputText('')
    try {
      const result = await callGroq(inputText, fromName, toName, false, groqKey)
      setOutputText(result)
    } catch (e: any) { setError(e.message || 'Translation failed') }
    finally { setTranslating(false) }
  }

  function swapLangs() {
    const prevOut = outputText
    setSrcLang(tgtLang); setTgtLang(srcLang)
    setInputText(prevOut); setOutputText('')
  }

  function copyOutput() {
    navigator.clipboard.writeText(outputText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  async function ingestFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase() || ''
    setFile(f); setDone(false); setProgress(0); translatedDataRef.current = []
    fileTypeRef.current = ext === 'csv' ? 'csv' : 'xlsx'
    try {
      if (ext === 'csv') {
        const text = await f.text()
        const res = Papa.parse(text, { skipEmptyLines: true })
        const rows = res.data as string[][]
        setFileRows(rows.length - 1)
        translatedDataRef.current = rows
        isPhrases.current = false
        sheetNameRef.current = ''
      } else {
        const buf = await f.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        wbRef.current = wb
        const sn = wb.SheetNames.find(s => s.toLowerCase() === 'phrases') || wb.SheetNames[0]
        sheetNameRef.current = sn
        isPhrases.current = sn.toLowerCase() === 'phrases'
        const ws = wb.Sheets[sn]
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })
        const trimmed = rows.filter(r => (r as string[]).some(c => c !== ''))
        setFileRows(trimmed.length - (isPhrases.current ? 2 : 1))
        translatedDataRef.current = trimmed as string[][]
      }
    } catch (e) { console.error(e) }
  }

  async function processDoc() {
    if (!file || !groqKey) return
    setProcessing(true); setProgress(0); setError('')
    try {
      const rows = translatedDataRef.current
      const srcCol = isPhrases.current ? 1 : 0
      const tgtCol = isPhrases.current ? 2 : 1
      const startRow = isPhrases.current ? 2 : 1
      const output = rows.map(r => [...r])

      // update translation header
      if (isPhrases.current && output[1]) {
        while (output[1].length <= tgtCol) output[1].push('')
        output[1][tgtCol] = `Translation (${toName})`
      }

      // gather source strings
      const sourceMap: { idx: number; text: string }[] = []
      for (let i = startRow; i < rows.length; i++) {
        const cell = String(rows[i][srcCol] || '').trim()
        if (cell) sourceMap.push({ idx: i, text: cell })
      }

      const texts = sourceMap.map(s => s.text)
      const batches = chunk(texts, BATCH)
      let allTranslated: string[] = []

      for (let b = 0; b < batches.length; b++) {
        const result = await callGroq(JSON.stringify(batches[b]), fromName, toName, true, groqKey)
        let parsed: string[]
        try {
          const clean = result.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
          parsed = JSON.parse(clean)
          if (!Array.isArray(parsed)) throw new Error('not array')
        } catch { parsed = result.split('\n').filter(Boolean) }
        allTranslated = allTranslated.concat(parsed)
        setProgress(Math.round(((b + 1) / batches.length) * 100))
      }

      for (let j = 0; j < sourceMap.length; j++) {
        const r = sourceMap[j].idx
        while (output[r].length <= tgtCol) output[r].push('')
        if (allTranslated[j] !== undefined) output[r][tgtCol] = allTranslated[j]
      }

      translatedDataRef.current = output
      setDone(true)
      setDoneMsg(`${sourceMap.length} strings translated into ${toName} — ${file.name}`)
    } catch (e: any) { setError(e.message || 'Processing failed') }
    finally { setProcessing(false) }
  }

  function downloadTranslation() {
    const data = translatedDataRef.current
    const stem = file!.name.replace(/\.[^.]+$/, '')
    const lang = tgtLang.replace('-', '')
    const today = new Date().toISOString().slice(0, 10)
    const outName = `${stem}_${lang}_${today}.${fileTypeRef.current}`
    if (fileTypeRef.current === 'csv') {
      const csv = Papa.unparse(data)
      dl(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), outName)
    } else {
      const wb = wbRef.current || XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(data)
      if (wbRef.current) wb.Sheets[sheetNameRef.current] = ws
      else XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      dl(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), outName)
    }
  }

  function dl(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 200)
  }

  const langOptions = Object.entries(LANG_NAMES).map(([v, l]) => <option key={v} value={v}>{l}</option>)
  const sB: React.CSSProperties = { padding: '0.75rem 1.5rem', borderRadius: 0, fontFamily: "'Inter',sans-serif", fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', border: 'none', cursor: 'pointer', transition: 'all .15s', background: 'none', color: 'var(--text-2)', borderBottom: '2px solid transparent' }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.58rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8, textAlign: 'center' }}>JLR · MENA</div>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 300, textAlign: 'center', color: 'var(--text)' }}>
          JLR <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Modern Luxury Translator</em>
        </h1>
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
        {[{ id: 'text', label: 'Text' }, { id: 'doc', label: 'Documents' }].map(t => (
          <button key={t.id} style={{ ...sB, color: mode === t.id ? 'var(--accent)' : 'var(--text-3)', borderBottomColor: mode === t.id ? 'var(--accent)' : 'transparent' }}
            onClick={() => setMode(t.id as 'text' | 'doc')}>{t.label}</button>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
        {/* Lang bar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 1.25rem', height: 56, borderBottom: '1px solid var(--border)', gap: '0.75rem' }}>
          <select className="field-select" value={srcLang} onChange={e => { if (e.target.value === tgtLang) setTgtLang(srcLang); setSrcLang(e.target.value) }} style={{ flex: 1 }}>{langOptions}</select>
          <button onClick={swapLangs} style={{ width: 34, height: 34, flexShrink: 0, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .25s' }} title="Swap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
          </button>
          <select className="field-select" value={tgtLang} onChange={e => { if (e.target.value === srcLang) setSrcLang(tgtLang); setTgtLang(e.target.value) }} style={{ flex: 1 }}>{langOptions}</select>
        </div>

        {mode === 'text' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 300 }}>
              <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', borderRight: '1px solid var(--border)' }}>
                <textarea value={inputText} onChange={e => setInputText(e.target.value)}
                  placeholder={`Enter ${LANG_NAMES[srcLang]} text to translate…`}
                  maxLength={8000} dir={RTL.has(srcLang) ? 'rtl' : 'ltr'}
                  onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); translate() } }}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: "'DM Sans','Inter',sans-serif", fontSize: '1rem', fontWeight: 300, lineHeight: 1.75, padding: '1.25rem 1.4rem', resize: 'none', minHeight: 280 }} />
                <span style={{ position: 'absolute', bottom: 12, right: 16, fontSize: '0.6rem', color: 'var(--text-3)', fontFamily: 'monospace', pointerEvents: 'none' }}>{inputText.length} / 8,000</span>
              </div>
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                {translating && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent 20%,rgba(0,208,132,.04) 50%,transparent 80%)', backgroundSize: '300% 100%', animation: 'shimmer 1.6s ease infinite', pointerEvents: 'none', zIndex: 1 }} />}
                <textarea value={outputText} readOnly dir={RTL.has(tgtLang) ? 'rtl' : 'ltr'}
                  placeholder={`${LANG_NAMES[tgtLang]} translation will appear here…`}
                  style={{ flex: 1, background: 'rgba(0,0,0,.12)', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: "'DM Sans','Inter',sans-serif", fontSize: '1rem', fontWeight: 300, lineHeight: 1.75, padding: '1.25rem 1.4rem', resize: 'none', minHeight: 280 }} />
              </div>
            </div>
            {error && <div style={{ padding: '0 1.4rem 0.75rem', fontSize: '0.7rem', color: 'var(--red)' }}>{error}</div>}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1rem 1.25rem', borderTop: '1px solid var(--border)' }}>
              <button className="btn-primary" onClick={translate} disabled={translating || !inputText.trim()}>
                {translating ? <><svg className="spinner" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9"/></svg>Translating…</> : 'Translate'}
              </button>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', letterSpacing: '0.08em' }}>⌘ / Ctrl + Enter</span>
              {outputText && <button className="btn-ghost" style={{ marginLeft: 'auto', ...(copied ? { color: '#22c55e', borderColor: 'rgba(34,197,94,.4)' } : {}) }} onClick={copyOutput}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>}
            </div>
          </>
        ) : (
          <div style={{ padding: '1.5rem' }}>
            {!file ? (
              <div
                style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '4rem 3rem', textAlign: 'center', cursor: 'pointer', transition: 'all .2s', background: 'var(--surface)' }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-dim)' }}
                onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.background = '' }}
                onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.background = ''; const f = e.dataTransfer.files[0]; if (f) ingestFile(f) }}>
                <svg width="40" height="40" style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--accent)', opacity: .6 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Drag & drop a file here</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', lineHeight: 1.7 }}>Supported: .csv, .xlsx · Col A = source, Col B = translation</p>
                <button className="btn-primary" style={{ marginTop: '1.25rem' }} onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>Browse Files</button>
              </div>
            ) : done ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1.75rem', background: 'rgba(0,208,132,.03)', border: '1px solid var(--accent-brd)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid var(--accent-brd)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <p style={{ fontFamily: 'Georgia,serif', fontSize: '1.1rem', fontWeight: 400 }}>Translation complete</p>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-2)', marginTop: 2 }}>{doneMsg}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" onClick={() => { setFile(null); setDone(false) }}>New document</button>
                  <button className="btn-primary" onClick={downloadTranslation}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download .{fileTypeRef.current}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid var(--accent-brd)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{file.name}</p>
                <p style={{ fontSize: '0.68rem', color: 'var(--text-2)', marginBottom: '1.25rem' }}>{fileRows} rows · Ready to translate into <strong style={{ color: 'var(--accent)' }}>{toName}</strong></p>
                {processing && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.65rem', color: 'var(--text-2)' }}>
                      <span>Processing…</span><span style={{ color: 'var(--accent)' }}>{progress}%</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,var(--accent),#00e896)', transition: 'width .3s', borderRadius: 2 }} />
                    </div>
                  </div>
                )}
                {error && <div style={{ color: 'var(--red)', fontSize: '0.7rem', marginBottom: '0.75rem' }}>{error}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button className="btn-ghost" onClick={() => { setFile(null); setError('') }}>Remove</button>
                  <button className="btn-primary" onClick={processDoc} disabled={processing}>
                    {processing ? 'Processing…' : 'Process Document'}
                  </button>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) ingestFile(f); e.target.value = '' }} />
          </div>
        )}
      </div>
      <p style={{ textAlign: 'center', fontSize: '0.6rem', color: 'var(--text-3)', marginTop: '1.5rem' }}>
        Powered by Groq · Llama 4 Scout · Modern Luxury brand voice · Translations should receive editorial review
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel Tool (Phrase Sheet + SpecsValue translators)
// ─────────────────────────────────────────────────────────────────────────────
const DRIVE_DB_FILES = [
  { label: 'AR — Arabic', id: '1Le2TYhokWsFsQZuRL5PwpJ99pSUJLgko', name: 'AR_TRANSLATIONS.xlsx' },
  { label: 'FR — French', id: '1U2jjW868uMKAamzi-lIXOObO48f-_cJL', name: 'FR_TRANSLATIONS.xlsx' },
  { label: 'RU — Russian', id: '10k33uhGW3KE6vPBYaohdgY-D6PBkb4-i', name: 'RU_TRANSLATIONS.xlsx' },
  { label: 'KZ — Kazakh', id: '1dVuvEZn3HkCWhkm1vbFJGr6j8PDZjKll', name: 'KZ_TRANSLATIONS.xlsx' },
  { label: 'KU — Kurdish', id: '1GvyQWVIdVwRfo1A1ZQEIVivChspnhDCX', name: 'KU_TRANSLATIONS.xlsx' },
  { label: 'GE — Georgian', id: '1CNXyT0CengA8xMsVLEJtADkGny_icMTV', name: 'GE_TRANSLATIONS.xlsx' },
  { label: 'AZ — Azerbaijani', id: '1kqcgYcdT_yhtty7KnyhUCEPzU30zyOct', name: 'AZ_TRANSLATIONS.xlsx' },
  { label: 'AM — Armenian', id: '1GLikWLAVsBxO26W7lCXr9FLLSqG-ezBh', name: 'AM_TRANSLATIONS.xlsx' },
]

async function fetchDriveFile(fileId: string, fileName: string): Promise<File> {
  const url = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download ${fileName}`)
  const blob = await res.blob()
  return new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

async function readXlsx(file: File): Promise<{ wb: XLSX.WorkBook; rows: any[][] }> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' })
  return { wb, rows }
}

function buildMap(rows: any[][]): Map<string, string> {
  const m = new Map<string, string>()
  for (const row of rows) {
    if (row[0] && row[1]) m.set(String(row[0]).trim().toLowerCase(), String(row[1]))
  }
  return m
}

function ToolCard({ number, title, info, onProcess }: { number: string; title: string; info: string; onProcess: (mainFile: File, dbFiles: File[]) => Promise<{ message: string; missing?: Set<string> }> }) {
  const [mainFile, setMainFile] = useState<File | null>(null)
  const [dbFiles, setDbFiles] = useState<File[]>([])
  const [processing, setProcessing] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(true)
  const [missing, setMissing] = useState<Set<string>>(new Set())
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveStatus, setDriveStatus] = useState('')
  const [selectedDrive, setSelectedDrive] = useState('')
  const mainRef = useRef<HTMLInputElement>(null)
  const dbRef = useRef<HTMLInputElement>(null)

  async function loadFromDrive() {
    const f = DRIVE_DB_FILES.find(d => d.id === selectedDrive)
    if (!f) return
    setDriveLoading(true); setDriveStatus('')
    try {
      const file = await fetchDriveFile(f.id, f.name)
      setDbFiles(prev => [...prev, file])
      setDriveStatus(`✓ ${f.name} loaded`)
      setSelectedDrive('')
    } catch (e: any) { setDriveStatus('✗ ' + e.message) }
    finally { setDriveLoading(false) }
  }

  async function process() {
    if (!mainFile || !dbFiles.length) return
    setProcessing(true); setMsg(''); setMissing(new Set())
    try {
      const result = await onProcess(mainFile, dbFiles)
      setMsg(result.message); setMsgOk(true)
      if (result.missing) setMissing(result.missing)
      setMainFile(null); setDbFiles([])
    } catch (e: any) { setMsg('Error: ' + e.message); setMsgOk(false) }
    finally { setProcessing(false) }
  }

  const iS: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }

  return (
    <div className="card" style={{ padding: '1.5rem', position: 'relative' }}>
      {(mainFile || dbFiles.length) ? (
        <button onClick={() => { setMainFile(null); setDbFiles([]); setMsg('') }}
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', width: 26, height: 26, borderRadius: '50%', background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>×</button>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent-brd)', padding: '2px 7px', borderRadius: 3 }}>{number}</span>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{title}</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Col 1: File to translate */}
        <div style={iS}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)' }}>File to translate</div>
          <div style={{ flex: 1, minHeight: 120, background: 'var(--surface-2)', border: mainFile ? '1px solid var(--accent-brd)' : '1.5px dashed var(--border)', borderRadius: 7, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, cursor: 'pointer', transition: 'all .15s' }}
            onClick={() => mainRef.current?.click()}>
            {mainFile ? (
              <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{ fontSize: '0.65rem', color: 'var(--accent)', textAlign: 'center', wordBreak: 'break-all' }}>{mainFile.name}</span></>
            ) : (
              <><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5"><path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>Click or drag file</span></>
            )}
            <input ref={mainRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setMainFile(f); e.target.value = '' }} />
          </div>
        </div>

        {/* Col 2: From Drive */}
        <div style={iS}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="13" height="13" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path fill="#0066da" d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"/><path fill="#00ac47" d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z"/><path fill="#ea4335" d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"/><path fill="#00832d" d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"/><path fill="#2684fc" d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"/><path fill="#ffba00" d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"/></svg>
            From Drive
          </div>
          <div style={{ flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7 }}>
            <select className="field-select" value={selectedDrive} onChange={e => setSelectedDrive(e.target.value)}>
              <option value="">— Select language —</option>
              {DRIVE_DB_FILES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <button style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-brd)', borderRadius: 5, color: 'var(--accent)', fontFamily: 'inherit', fontSize: '0.65rem', fontWeight: 700, padding: '6px 10px', cursor: selectedDrive ? 'pointer' : 'not-allowed', opacity: selectedDrive ? 1 : 0.4 }} disabled={!selectedDrive || driveLoading} onClick={loadFromDrive}>
              {driveLoading ? 'Downloading…' : 'Load from Drive'}
            </button>
            {driveStatus && <div style={{ fontSize: '0.6rem', color: driveStatus.startsWith('✓') ? 'var(--accent)' : 'var(--red)', textAlign: 'center' }}>{driveStatus}</div>}
          </div>
        </div>

        {/* Col 3: Upload manually */}
        <div style={iS}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Upload manually</div>
          <div style={{ flex: 1, minHeight: 120, background: 'var(--surface-2)', border: '1.5px dashed var(--border)', borderRadius: 7, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 6, padding: 12, cursor: 'pointer' }}
            onClick={() => dbRef.current?.click()}>
            {dbFiles.length ? dbFiles.map(f => (
              <div key={f.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '4px 8px', borderRadius: 5, background: 'var(--surface-3)', border: '1px solid var(--border)', fontSize: '0.65rem', color: 'var(--text-2)' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.name}</span>
                <button onClick={e => { e.stopPropagation(); setDbFiles(prev => prev.filter(x => x.name !== f.name)) }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 2 }}>×</button>
              </div>
            )) : (
              <><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5"><path d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375"/></svg>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>Click or drag files</span></>
            )}
            <input ref={dbRef} type="file" accept=".xlsx,.xls" multiple style={{ display: 'none' }} onChange={e => { const files = [...(e.target.files || [])]; setDbFiles(prev => [...prev, ...files.filter(f => !prev.some(p => p.name === f.name))]); e.target.value = '' }} />
          </div>
        </div>
      </div>

      <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!mainFile || !dbFiles.length || processing} onClick={process}>
        {processing ? 'Processing…' : 'Translate'}
      </button>

      {msg && (
        <div style={{ marginTop: 10, textAlign: 'center', fontSize: '0.7rem', color: msgOk ? 'var(--accent)' : 'var(--red)', animation: 'toast-in .3s ease' }}>
          <span dangerouslySetInnerHTML={{ __html: msg }} />
          {missing.size > 0 && (
            <div style={{ marginTop: 10, textAlign: 'left', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', maxHeight: 160, overflowY: 'auto', fontSize: '0.62rem' }}>
              <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>Missing translations ({missing.size}):</p>
              <ul style={{ listStyle: 'disc', paddingLeft: '1.2rem' }}>
                {[...missing].slice(0, 50).map(m => <li key={m} style={{ fontFamily: 'monospace', margin: '3px 0', color: 'var(--text-2)' }}>{m}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Tool 1: Phrase Sheet Translator
async function processPhrases(mainFile: File, dbFiles: File[]): Promise<{ message: string; missing: Set<string> }> {
  const transMap = new Map<string, string>()
  for (const f of dbFiles) {
    const { rows } = await readXlsx(f)
    for (const row of rows) { if (row[0] && row[1]) transMap.set(String(row[0]).trim().toLowerCase(), String(row[1])) }
  }
  const { wb } = await readXlsx(mainFile)
  let translated = 0
  const missing = new Set<string>()
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const a2 = ws['A2'] ? String(ws['A2'].v).trim() : ''
    const b2 = ws['B2'] ? String(ws['B2'].v).trim() : ''
    const c2 = ws['C2'] ? String(ws['C2'].v).trim() : ''
    if (a2 === 'Key' && b2 === 'Original phrase' && c2 === 'Translation') {
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
      for (let R = 2; R <= range.e.r; R++) {
        const bAddr = XLSX.utils.encode_cell({ r: R, c: 1 })
        const cAddr = XLSX.utils.encode_cell({ r: R, c: 2 })
        const cell = ws[bAddr]
        if (!cell) continue
        const key = String(cell.v).trim().toLowerCase()
        const tr = transMap.get(key)
        if (tr) { XLSX.utils.sheet_add_aoa(ws, [[tr]], { origin: cAddr }); translated++ } else { if (key) missing.add(key) }
      }
    }
  }
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `translated_${mainFile.name}`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  return { message: `<strong>Done.</strong> Translated ${translated} cells. File downloaded.`, missing }
}

// Tool 2: SpecsValue Translator
async function processSpecs(mainFile: File, dbFiles: File[]): Promise<{ message: string; missing: Set<string> }> {
  const transMap = new Map<string, string>()
  for (const f of dbFiles) {
    const { rows } = await readXlsx(f)
    for (const row of rows) { if (row[0] && row[1]) transMap.set(String(row[0]).trim().toLowerCase(), String(row[1])) }
  }
  const { wb } = await readXlsx(mainFile)
  const ws = wb.Sheets['SpecsValue']
  if (!ws) throw new Error("File must contain a 'SpecsValue' sheet.")
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  const missing = new Set<string>()
  for (let R = range.s.r; R <= range.e.r; R++) {
    const bCell = ws[XLSX.utils.encode_cell({ r: R, c: 1 })]
    const cCell = ws[XLSX.utils.encode_cell({ r: R, c: 2 })]
    if (!cCell) continue
    const ft = bCell ? (XLSX.utils.format_cell(bCell) || '').toLowerCase().trim() : ''
    let val = String(cCell.w || cCell.v || '').replace(/\s+/g, ' ').trim()
    if (ft === 'features' || ft === 'full_features') {
      let out = '', i = 0
      while (i < val.length) {
        const s = val.indexOf('>', i); if (s < 0) { out += val.slice(i); break }
        const e = val.indexOf('<', s + 1); if (e < 0) { out += val.slice(i); break }
        out += val.slice(i, s + 1)
        const frag = val.slice(s + 1, e).trim()
        const tr = transMap.get(frag.toLowerCase())
        if (tr) out += tr; else { out += val.slice(s + 1, e); if (frag) missing.add(frag) }
        i = e
      }
      val = out
    } else if (ft === 'transmission') {
      const tr = transMap.get('automatic')
      if (tr) val = val.replace(/\bautomatic\b/gi, tr)
    } else {
      for (const term of ['air suspension','coil suspension','seats','seat','air','coil']) {
        const tr = transMap.get(term)
        if (tr) val = val.replace(new RegExp(`\\b${term}\\b`, 'gi'), tr)
      }
    }
    cCell.v = val; cCell.t = 's'; delete (cCell as any).w
  }
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `translated_${mainFile.name}`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  return { message: `<strong>Done.</strong> File downloaded.${missing.size ? ` Missing: ${missing.size}` : ''}`, missing }
}

function ExcelTool() {
  return (
    <div>
      <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text)' }}>
          Excel <span style={{ color: 'var(--accent)' }}>Translation</span> Tool
        </h1>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 4 }}>Reffine MENA · Phrase & SpecsValue translator</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <ToolCard number="01" title="Phrase Sheet Translator" info="Translates sheets with Key/Original phrase/Translation headers" onProcess={processPhrases} />
        <ToolCard number="02" title="SpecsValue Sheet Translator" info="Translates the SpecsValue sheet with multi-rule logic" onProcess={processSpecs} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page with Top Tab Switcher
// ─────────────────────────────────────────────────────────────────────────────
export function TranslationPage() {
  const [tab, setTab] = useState<'translate' | 'tool'>('translate')
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const TOP = 60 + 41 // nav + tab bar

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <TopNav />

      {/* Tab bar */}
      <div style={{ position: 'fixed', top: 60, left: 0, right: 0, height: 41, background: isDark ? 'rgba(10,11,13,.97)' : 'rgba(255,255,255,.97)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 6, zIndex: 88, backdropFilter: 'blur(12px)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '.08em', color: 'var(--text)', marginRight: 8 }}>Translation Tools</span>
        {(['translate', 'tool'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '4px 14px', borderRadius: 5, border: '1px solid', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 600, transition: 'all .15s',
              background: tab === t ? 'var(--accent-dim)' : 'none',
              borderColor: tab === t ? 'var(--accent-brd)' : 'var(--border)',
              color: tab === t ? 'var(--accent)' : 'var(--text-2)' }}>
            {t === 'translate' ? '🌐 AI Translator' : '📊 Excel Tool'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ paddingTop: TOP, flex: 1, minHeight: `calc(100vh - ${TOP}px)`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '2rem 1.5rem 4rem', width: '100%', flex: 1, overflowY: 'auto' }}>
          {tab === 'translate' && <AITranslator />}
          {tab === 'tool' && <ExcelTool />}
        </div>
        <Footer />
      </div>

      <style>{`@keyframes shimmer{0%{background-position:-300% 0}100%{background-position:300% 0}}`}</style>
    </div>
  )
}
