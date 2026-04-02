import { useState, useRef } from 'react'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'
import * as XLSX from 'xlsx'

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

export function TranslationToolPage() {
  return (
    <div style={{ paddingTop: 60 }}>
      <TopNav />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
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
      <Footer />
    </div>
  )
}
