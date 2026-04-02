import { useState, useRef } from 'react'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'
import JSZip from 'jszip'

const WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
function wq(el: Element | Document, tag: string) { return Array.from(el.getElementsByTagNameNS(WNS, tag)) }
function cellAllText(tc: Element): string { return wq(tc, 'p').map(p => wq(p, 'r').map(r => wq(r, 't').map(t => t.textContent).join('')).join('')).join('\n') }
function cellFirstLine(tc: Element): string { for (const p of wq(tc, 'p')) { const t = wq(p, 'r').map(r => wq(r, 't').map(t => t.textContent).join('')).join('').trim(); if (t) return t } return '' }

function textToHtml(raw: string): string {
  if (!raw?.trim()) return ''
  const lines = raw.split('\n').map(l => l.replace(/[\u00a0\u202f\u200b]+/g, ' ').trim()).filter(Boolean)
  if (!lines.length) return ''
  function isHeader(l: string) { return l.length <= 80 && /[:\uFF1A]\s*$/.test(l) && !/^[-*\u2022]/.test(l) }
  function isDisc(l: string) { return /^[-\u2013\u2014\u2022]/.test(l) || /(terms|conditions|please contact|enquiry)/i.test(l) }
  const hi = lines.findIndex(isHeader)
  if (hi === -1) return `<p>${lines.join('<br><br>\n')}</p>`
  const intro = lines.slice(0, hi), header = lines[hi], after = lines.slice(hi + 1)
  const items: string[] = [], subs: string[] = []
  let inSub = false
  for (const ln of after) { if (inSub || isDisc(ln)) { inSub = true; subs.push(ln.replace(/^[-\u2013\u2014\u2022\s]+/, '').trim()) } else items.push(ln.replace(/^[*\u2022]\s*/, '').trim()) }
  const parts: string[] = []
  if (intro.length) parts.push(`<p>${intro.join('<br><br>\n')}</p>`)
  parts.push(`<p><b>${header}</b></p>`)
  if (items.length) parts.push(`<ul>\n${items.map(x => `     <li>${x}</li>`).join('\n')}\n</ul>`)
  if (subs.length) parts.push(`<sub>- ${subs[0]}${subs.length > 1 ? `<br><br>\n${subs.slice(1).join(' ')}` : ''}</sub>`)
  return parts.join('\n')
}

async function parseDocx(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer)
  const xmlStr = await zip.file('word/document.xml')!.async('string')
  const xmlDoc = new DOMParser().parseFromString(xmlStr, 'application/xml')
  const tables = wq(xmlDoc.documentElement, 'tbl')
  if (!tables.length) throw new Error('No tables found in document.')

  let mainTable: Element | null = null, colMap = { EN: 1, AR: 2, FR: 3 }
  for (const tbl of tables) {
    const rows = wq(tbl, 'tr')
    if (!rows.length) continue
    const hcells = wq(rows[0], 'tc')
    const hdrs = hcells.map(tc => cellFirstLine(tc).toLowerCase())
    const ei = hdrs.findIndex(h => h.includes('english'))
    const ai = hdrs.findIndex(h => h.includes('arabic') || /[\u0600-\u06ff]/.test(h))
    const fi = hdrs.findIndex(h => h.includes('french') || h.includes('fran'))
    if (ei > 0 && ai > 0 && fi > 0) { mainTable = tbl; colMap = { EN: ei, AR: ai, FR: fi }; break }
  }
  if (!mainTable) mainTable = tables[1] || tables[0]

  const rows = wq(mainTable, 'tr')
  const ROW_DEFS: [string, RegExp][] = [
    ['h1', /headline\s*1\b(?!\s*\()/i], ['h2', /headline\s*2\b/i], ['h3a', /headline\s*3a\b/i],
    ['h3b', /headline\s*3b\b/i], ['h4', /headline\s*4\b/i], ['h5', /headline\s*5\b/i],
    ['cta', /^cta$/i], ['sh1', /headline\s*1\s*\(drop/i], ['sh2', /headline\s*2\s*\(drop/i],
    ['sh3', /headline\s*3\s*\(drop/i], ['desc', /offer\s*description/i]
  ]
  const rowCells: Record<string, Element[]> = {}
  for (const row of rows.slice(1)) {
    const cells = wq(row, 'tc')
    if (!cells.length) continue
    const label = cellAllText(cells[0]).toLowerCase().replace(/\s+/g, ' ').trim()
    for (const [key, pat] of ROW_DEFS) { if (!rowCells[key] && pat.test(label)) { rowCells[key] = cells; break } }
  }

  const rawTexts: Record<string, string> = {}
  function getField(key: string, lang: 'EN' | 'AR' | 'FR') {
    const cells = rowCells[key]; if (!cells) return ''
    const col = colMap[lang]; return (col >= 0 && cells[col]) ? cellFirstLine(cells[col]).trim() : ''
  }
  function getDescRaw(lang: 'EN' | 'AR' | 'FR') {
    const cells = rowCells['desc']; if (!cells) return ''
    const col = colMap[lang]; return (col >= 0 && cells[col]) ? cellAllText(cells[col]) : ''
  }

  let anchor2 = ''
  const allText = wq(tables[0], 't').map(t => t.textContent).join('')
  const m = allText.match(/URL:\s*#([\w-]+)/i)
  if (m) anchor2 = m[1].trim()

  const records: Record<string, any> = {}
  for (const lang of ['EN', 'AR', 'FR'] as const) {
    const raw = getDescRaw(lang); rawTexts[lang] = raw
    const h3 = getField('h3a', lang) || getField('h3b', lang)
    const h2 = getField('h2', lang)
    records[lang] = { lang, h1: getField('h1', lang), h2, h3, h4: getField('h4', lang), h5: getField('h5', lang), sh1: getField('sh1', lang), sh2: getField('sh2', lang), sh3: getField('sh3', lang), cta: getField('cta', lang), desc: textToHtml(raw), feed: h3 || h2, feed2: '' }
  }
  return { records, anchor2, rawTexts }
}

function esc(s: string) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

export function OfferGeneratorPage() {
  const [file, setFile] = useState<File | null>(null)
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null)
  const [rawTexts, setRawTexts] = useState<Record<string, string>>({})
  const [rec, setRec] = useState<Record<string, any> | null>(null)
  const [log, setLog] = useState('')
  const [logType, setLogType] = useState<'ok' | 'err' | 'info'>('info')
  const [activeLang, setActiveLang] = useState('EN')
  const [anchor1, setAnchor1] = useState('')
  const [anchor2, setAnchor2] = useState('')
  const [sub, setSub] = useState('')
  const [seq, setSeq] = useState('')
  const [theme, setTheme] = useState('light')
  const [startId, setStartId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [slugs, setSlugs] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  function setL(msg: string, t: 'ok' | 'err' | 'info') { setLog(msg); setLogType(t) }

  async function handleFile(f: File) {
    if (!/\.docx$/i.test(f.name)) { setL('Please choose a .docx file.', 'err'); return }
    setFile(f); setL('Parsing DOCX…', 'info')
    const buf = await f.arrayBuffer()
    setFileBuffer(buf)
    try {
      const { records, anchor2: a2, rawTexts: rt } = await parseDocx(buf)
      setRec(records); setAnchor2(a2); setRawTexts(rt)
      setL('Parsed successfully. Review each tab then Export CSV.', 'ok')
    } catch (e: any) { setL('Error: ' + e.message, 'err') }
  }

  function updateField(lang: string, field: string, val: string) {
    setRec(prev => prev ? { ...prev, [lang]: { ...prev[lang], [field]: val } } : prev)
  }

  function reparse() {
    if (!rec) return
    const next = { ...rec }
    for (const lang of ['EN', 'AR', 'FR']) {
      const html = textToHtml(rawTexts[lang] || '')
      next[lang] = { ...next[lang], desc: html }
    }
    setRec(next); setL('Descriptions re-parsed from original DOCX text.', 'ok')
  }

  function genRandomSlugs() {
    const chars = 'abcdefghijklmnopqrstuvwxyz'
    const out = new Set<string>()
    while (out.size < 10) { let s = ''; for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * 26)]; out.add(s) }
    setSlugs([...out])
  }

  function exportCSV() {
    if (!rec) return
    const now = (() => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} +0100` })()
    const today = new Date().toISOString().slice(0, 10)
    const COLS = ['Id','Title','Created at','Updated at','Start date','End date','Headline 1','Headline 2','Headline 3','Headline 4','Headline 5','Subheadline 1','Subheadline 2','Subheadline 3','Description','Anchor 1','Anchor 2','Cta label','Subcategory','Vins','Sequence','Feed headline','Feed headline 2','Feed theme']
    const rows = ['EN', 'AR', 'FR'].map((lang, i) => {
      const r = rec[lang]; const id = startId ? parseInt(startId) + i : ''
      const title = `${r.h1 ? r.h1.trim() + ' ' : ''}${lang}`
      return [id, title, now, now, startDate, endDate, r.h1||'', r.h2||'', r.h3||'', r.h4||'', r.h5||'', r.sh1||'', r.sh2||'', r.sh3||'', r.desc||'', anchor1, anchor2, r.cta||'', sub, '', seq, r.feed||'', r.feed2||'', theme]
    })
    function csvField(v: any, forceQuote: boolean) {
      const s = String(v ?? '')
      return (forceQuote || /[,\n\r"]/.test(s)) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [COLS.map(c => csvField(c, false)).join(',')]
    rows.forEach(row => lines.push(row.map((v, ci) => csvField(v, ci === 14)).join(',')))
    const csv = lines.join('\r\n')
    const base = (file?.name || 'offers').replace(/\.docx$/i, '')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${base}-${today}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setL(`Exported — 3 rows, 24 columns.`, 'ok')
  }

  const iS: React.CSSProperties = { width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', fontFamily: "'Inter',sans-serif", fontSize: '0.7rem', padding: '0.5rem 0.7rem', outline: 'none' }

  return (
    <div style={{ paddingTop: 60 }}>
      <TopNav />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, paddingBottom: 18, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid var(--accent-brd)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="1.5"><rect x="2" y="3" width="11" height="14" rx="1.5"/><path d="M5 7h5M5 10h5M5 13h3"/><path d="M14 6l4 4-4 4"/></svg>
          </div>
          <div>
            <h1 style={{ fontFamily: 'Rajdhani,Georgia,sans-serif', fontWeight: 700, fontSize: 22, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Offer Studio</h1>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Parse Word offer template · Review per language · Export CMS-ready CSV</p>
          </div>
        </div>

        {/* Import card */}
        <div className="card" style={{ padding: '1.1rem 1.25rem', marginBottom: 12 }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 3, height: 14, background: 'var(--accent)', borderRadius: 2, flexShrink: 0, display: 'inline-block' }} /> Import & Export
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'rgba(255,255,255,.04)', color: 'var(--text)', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', transition: 'all .15s' }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" opacity=".8"><path d=".5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/></svg>
              Choose .docx
              <input ref={fileRef} type="file" accept=".docx" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </label>
            <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', padding: '5px 12px', borderRadius: 100, background: 'var(--surface-2)', border: '1px solid var(--border)', color: file ? 'var(--accent)' : 'var(--text-3)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file ? file.name + '  ·  ' + (file.size / 1024).toFixed(1) + ' KB' : 'No file selected'}
            </span>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...iS, width: 'auto', colorScheme: 'dark' }} />
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...iS, width: 'auto', colorScheme: 'dark' }} />
            </div>
            {rec && <>
              <button className="btn-primary" onClick={exportCSV}>↓ Export CSV</button>
              <button className="btn-ghost" onClick={reparse}>↺ Re-parse</button>
            </>}
          </div>
          {log && <div style={{ fontSize: '0.65rem', marginTop: 10, color: logType === 'ok' ? 'var(--accent)' : logType === 'err' ? 'var(--red)' : 'var(--orange)' }}>{log}</div>}
        </div>

        {rec && (
          <div className="card" style={{ padding: '1.25rem' }}>
            {/* Shared fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10, paddingBottom: 18, marginBottom: 18, borderBottom: '1px solid var(--border)' }}>
              {[
                { label: 'Anchor 1 · Model slug', val: anchor1, set: setAnchor1, placeholder: 'range-rover-sport-wcdm' },
                { label: 'Anchor 2 · Offer slug', val: anchor2, set: setAnchor2, placeholder: 'exclusive-trade-in' },
                { label: 'Subcategory', val: sub, set: setSub, placeholder: '' },
                { label: 'Sequence', val: seq, set: setSeq, placeholder: '0' },
                { label: 'Starting ID', val: startId, set: setStartId, placeholder: '1005' },
              ].map(({ label, val, set, placeholder }) => (
                <div key={label}>
                  <div style={{ fontSize: '0.54rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5 }}>{label}</div>
                  <input className="field-input" value={val} onChange={e => set(e.target.value)} placeholder={placeholder} />
                </div>
              ))}
              <div>
                <div style={{ fontSize: '0.54rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5 }}>Feed Theme</div>
                <select className="field-select" value={theme} onChange={e => setTheme(e.target.value)}>
                  <option value="light">light</option><option value="dark">dark</option>
                </select>
              </div>
            </div>

            {/* Random slug */}
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn-ghost" onClick={genRandomSlugs} style={{ fontSize: '0.65rem' }}>Generate random slugs</button>
              {slugs.map(s => (
                <button key={s} onClick={() => setAnchor1(s)} style={{ padding: '3px 10px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700, fontFamily: 'monospace', background: anchor1 === s ? 'var(--accent-dim)' : 'var(--surface-3)', border: '1px solid var(--border)', color: anchor1 === s ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', letterSpacing: '0.12em' }}>
                  {s}
                </button>
              ))}
            </div>

            {/* Lang tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 18, padding: 4, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', width: 'fit-content' }}>
              {['EN', 'AR', 'FR'].map(l => (
                <button key={l} onClick={() => setActiveLang(l)}
                  style={{ height: 32, padding: '0 18px', borderRadius: 6, border: 'none', background: activeLang === l ? 'var(--accent)' : 'transparent', color: activeLang === l ? '#061a0d' : 'var(--text-3)', fontSize: '0.78rem', fontWeight: 600, fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all .15s' }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Lang editor */}
            {['EN', 'AR', 'FR'].map(lang => activeLang !== lang ? null : (
              <div key={lang} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {['h1','h2','h3','h4','h5','cta','sh1','sh2','sh3'].map(field => (
                      <div key={field}>
                        <div style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>{field === 'cta' ? 'CTA Label' : field === 'h1' ? 'Headline 1' : field.replace('h', 'Headline ').replace('sh', 'Subheadline ')}</div>
                        <input className="field-input" value={rec[lang][field] || ''} onChange={e => updateField(lang, field, e.target.value)} dir={lang === 'AR' ? 'rtl' : 'ltr'} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>Description HTML</div>
                    <textarea value={rec[lang].desc || ''} onChange={e => updateField(lang, 'desc', e.target.value)}
                      dir={lang === 'AR' ? 'rtl' : 'ltr'}
                      style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', fontFamily: 'monospace', fontSize: '0.68rem', padding: '0.5rem 0.7rem', outline: 'none', resize: 'vertical', minHeight: 180 }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
                    Description · Live Preview
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, minHeight: 180, background: 'var(--surface-2)', fontSize: 13, lineHeight: 1.65, overflow: 'auto' }}
                    dangerouslySetInnerHTML={{ __html: rec[lang].desc || '' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
