import { useState, useRef } from 'react'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'
import Papa from 'papaparse'
import JSZip from 'jszip'

// Country code mapping for backup filenames
const COUNTRY_CODES: Record<string, string> = {
  'United Arab Emirates': 'UAE', 'Saudi Arabia': 'KSA', 'Qatar': 'QA', 'Oman': 'OM',
  'Bahrain': 'BH', 'Kuwait': 'KW', 'Jordan': 'JO', 'Egypt': 'EG', 'Iraq': 'IQ',
  'Morocco': 'MA', 'Lebanon': 'LB', 'Azerbaijan': 'AZ', 'Georgia': 'GE',
  'Kazakhstan': 'KZ', 'Armenia': 'AM', 'Palestine': 'PS', 'Tunisia': 'TN', 'Algeria': 'DZ'
}

const COLS = ['id','address','www','additional_www','phone','email','tag_class','tags','day_1','day_2','day_3','day_4','day_5','day_6','day_7','city','lat','lng','headlineid','name','position']
const DS_MON = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const DS_SUN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

interface Retailer { [key: string]: string }

const COUNTRIES = [
  { name:'United Arab Emirates', flag:'🇦🇪', weekStart:1, lr:[{disp:'EN',url:'https://api2.mena.uae.lr.prod.reffine.com/en/jlr-admin/api/dealers.csv'},{disp:'AR',url:'https://api2.mena.uae.lr.prod.reffine.com/ar/jlr-admin/api/dealers.csv'}] },
  { name:'Saudi Arabia', flag:'🇸🇦', weekStart:0, lr:[{disp:'EN',url:'https://api2.mena.ksa.lr.prod.reffine.com/en/jlr-admin/api/dealers.csv'},{disp:'AR',url:'https://api2.mena.ksa.lr.prod.reffine.com/ar/jlr-admin/api/dealers.csv'}] },
  { name:'Qatar', flag:'🇶🇦', weekStart:0, lr:[{disp:'EN',url:'https://api.mena-qatar.lr.prod.reffine.com/en/jlr-admin/api/dealers.csv'},{disp:'AR',url:'https://api.mena-qatar.lr.prod.reffine.com/ar/jlr-admin/api/dealers.csv'}] },
  { name:'Oman', flag:'🇴🇲', weekStart:0, lr:[{disp:'EN',url:'https://api2.mena.oman.lr.prod.reffine.com/en/jlr-admin/api/dealers.csv'},{disp:'AR',url:'https://api2.mena.oman.lr.prod.reffine.com/ar/jlr-admin/api/dealers.csv'}] },
  { name:'Bahrain', flag:'🇧🇭', weekStart:0, lr:[{disp:'EN',url:'https://api.mena-bahrain.lr.prod.reffine.com/en/jlr-admin/api/dealers.csv'},{disp:'AR',url:'https://api.mena-bahrain.lr.prod.reffine.com/ar/jlr-admin/api/dealers.csv'}] },
  { name:'Kuwait', flag:'🇰🇼', weekStart:0, lr:[{disp:'EN',url:'https://api.mena-kuwait.lr.prod.reffine.com/en/jlr-admin/api/dealers.csv'},{disp:'AR',url:'https://api.mena-kuwait.lr.prod.reffine.com/ar/jlr-admin/api/dealers.csv'}] },
  { name:'Jordan', flag:'🇯🇴', weekStart:0, lr:[{disp:'EN',url:'https://api.mena-jordan.lr.prod.reffine.com/en/jlr-admin/api/dealers.csv'},{disp:'AR',url:'https://api.mena-jordan.lr.prod.reffine.com/ar/jlr-admin/api/dealers.csv'}] },
  { name:'Egypt', flag:'🇪🇬', weekStart:0, lr:[{disp:'EN',url:'https://api.mena-egypt.lr.prod.reffine.com/en/jlr-admin/api/dealers.csv'},{disp:'AR',url:'https://api.mena-egypt.lr.prod.reffine.com/ar/jlr-admin/api/dealers.csv'}] },
  { name:'Iraq', flag:'🇮🇶', weekStart:0, lr:[{disp:'EN',url:'https://api.mena-iraq.lr.prod.reffine.com/en/jlr-admin/api/dealers.csv'},{disp:'AR',url:'https://api.mena-iraq.lr.prod.reffine.com/ar/jlr-admin/api/dealers.csv'},{disp:'KU',url:'https://api.mena-iraq.lr.prod.reffine.com/ku/jlr-admin/api/dealers.csv'}] },
  { name:'Morocco', flag:'🇲🇦', weekStart:1, lr:[{disp:'EN',url:'https://api2.mena.morocco.lr.prod.reffine.com/en/jlr-admin/api/dealers.csv'},{disp:'AR',url:'https://api2.mena.morocco.lr.prod.reffine.com/ar/jlr-admin/api/dealers.csv'},{disp:'FR',url:'https://api2.mena.morocco.lr.prod.reffine.com/fr/jlr-admin/api/dealers.csv'}] },
  { name:'Lebanon', flag:'🇱🇧', weekStart:1, lr:[{disp:'EN',url:'https://api.mena.lebanon.lr.prod.reffine.com/en/jlr-admin/api/dealers.csv'},{disp:'AR',url:'https://api.mena.lebanon.lr.prod.reffine.com/ar/jlr-admin/api/dealers.csv'},{disp:'FR',url:'https://api.mena.lebanon.lr.prod.reffine.com/fr/jlr-admin/api/dealers.csv'}] },
  { name:'Azerbaijan', flag:'🇦🇿', weekStart:1, lr:[{disp:'EN',url:'https://api.mena-azerbaijan.lr.prod.reffine.com/en/jlr-admin/api/dealers.csv'},{disp:'AZ',url:'https://api.mena-azerbaijan.lr.prod.reffine.com/az/jlr-admin/api/dealers.csv'}] },
  { name:'Georgia', flag:'🇬🇪', weekStart:1, lr:[{disp:'EN',url:'https://api.mena-georgia.lr.prod.reffine.com/en/jlr-admin/api/dealers.csv'},{disp:'GE',url:'https://api.mena-georgia.lr.prod.reffine.com/ge/jlr-admin/api/dealers.csv'}] },
  { name:'Kazakhstan', flag:'🇰🇿', weekStart:1, lr:[{disp:'EN',url:'https://api.mena.kazakhstan.lr.prod.reffine.com/en/jlr-admin/api/dealers.csv'},{disp:'KZ',url:'https://api.mena.kazakhstan.lr.prod.reffine.com/kz/jlr-admin/api/dealers.csv'},{disp:'RU',url:'https://api.mena.kazakhstan.lr.prod.reffine.com/ru/jlr-admin/api/dealers.csv'}] },
  { name:'Armenia', flag:'🇦🇲', weekStart:1, lr:[{disp:'EN',url:'https://api.mena.armenia.lr.prod.reffine.com/en/jlr-admin/api/dealers.csv'},{disp:'AM',url:'https://api.mena.armenia.lr.prod.reffine.com/am/jlr-admin/api/dealers.csv'},{disp:'RU',url:'https://api.mena.armenia.lr.prod.reffine.com/ru/jlr-admin/api/dealers.csv'}] },
]

async function fetchCSV(url: string): Promise<string> {
  const proxies = [
    (u: string) => u,
    (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  ]
  for (const p of proxies) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(p(url), { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const t = text.trim()
      if (!t || t.length < 5) throw new Error('empty')
      if (t.startsWith('<!DOCTYPE') || t.startsWith('<html')) throw new Error('got HTML')
      return text
    } catch (e) { console.warn('proxy failed:', e) }
  }
  throw new Error('All proxies failed')
}

function parseResponse(text: string): Retailer[] {
  const t = text.trim()
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      let parsed = JSON.parse(t)
      if (typeof parsed.contents === 'string') parsed = JSON.parse(parsed.contents.trim())
      const arr = Array.isArray(parsed) ? parsed : (parsed.data || parsed.dealers || parsed.results || parsed.items || [])
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.filter(r => r.name || r.address || r.city || r.phone).map((r, i) => {
          const o: Retailer = {}
          COLS.forEach(c => { o[c] = '' })
          Object.keys(r).forEach(k => { o[k] = String(r[k] ?? '') })
          if (!o.id) o.id = `row-${i + 1}`
          return o
        })
      }
    } catch {}
  }
  const res = Papa.parse(text, { header: true, skipEmptyLines: 'greedy' as any })
  return (res.data as any[]).filter(r => r.name || r.address || r.city || r.phone).map((r, i) => {
    const o: Retailer = {}
    COLS.forEach(c => { o[c] = '' })
    Object.keys(r).forEach(k => { o[k] = String(r[k] ?? '').trim() })
    if (!o.id) o.id = `row-${i + 1}`
    return o
  })
}

export function RetailerLocatorPage() {
  const [rows, setRows] = useState<Retailer[]>([])
  const [orig, setOrig] = useState<Retailer[]>([])
  const [mods, setMods] = useState<Set<string>>(new Set())
  const [cur, setCur] = useState<string | null>(null)
  const [srch, setSrch] = useState('')
  const [filt, setFilt] = useState('all')
  const [weekStart, setWeekStart] = useState(1)
  const [loadingBtn, setLoadingBtn] = useState<string | null>(null)
  const [fb, setFb] = useState('retailers')
  const [screen, setScreen] = useState<'load' | 'editor'>('load')
  const [backupProgress, setBackupProgress] = useState<{done:number;total:number;msg:string}|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function backupAllMarkets(brand: 'LRDX' | 'RR' | 'JDX') {
    // All brands share the same retailer database per market (LR API)
    const zip = new JSZip()
    const total = COUNTRIES.reduce((s, c) => s + c.lr.length, 0)
    let done = 0
    setBackupProgress({ done: 0, total, msg: 'Starting backup…' })
    for (const country of COUNTRIES) {
      const code = COUNTRY_CODES[country.name] || country.name.replace(/\s/g,'').toUpperCase().slice(0,3)
      for (const ep of country.lr) {
        const fname = `${brand}-${code}-${ep.disp}.csv`
        try {
          setBackupProgress({ done, total, msg: `Fetching ${fname}…` })
          const text = await fetchCSV(ep.url)
          zip.file(fname, text)
        } catch {
          zip.file(fname, `# Failed to fetch: ${ep.url}\n`)
        }
        done++
        setBackupProgress({ done, total, msg: `${fname} done` })
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const date = new Date().toISOString().slice(0,10).replace(/-/g,'')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${brand}_MENA_Backup_${date}.zip`
    a.click()
    setBackupProgress(null)
  }

  async function backupAll() {
    const zip = new JSZip()
    const brands: Array<'LRDX'|'RR'|'JDX'> = ['LRDX','RR','JDX']
    const total = brands.length * COUNTRIES.reduce((s,c) => s + c.lr.length, 0)
    let done = 0
    setBackupProgress({ done: 0, total, msg: 'Starting full backup…' })
    for (const brand of brands) {
      for (const country of COUNTRIES) {
        const code = COUNTRY_CODES[country.name] || country.name.replace(/\s/g,'').toUpperCase().slice(0,3)
        for (const ep of country.lr) {
          const fname = `${brand}-${code}-${ep.disp}.csv`
          try {
            setBackupProgress({ done, total, msg: `Fetching ${fname}…` })
            const text = await fetchCSV(ep.url)
            zip.file(fname, text)
          } catch {
            zip.file(fname, `# Failed to fetch: ${ep.url}\n`)
          }
          done++
          setBackupProgress({ done, total, msg: `${done}/${total} done` })
        }
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const date = new Date().toISOString().slice(0,10).replace(/-/g,'')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ALL_MENA_Backup_${date}.zip`
    a.click()
    setBackupProgress(null)
  }

  const DS = weekStart === 0 ? DS_SUN : DS_MON

  async function loadFromUrl(url: string, countryName: string, ws: number, btnId: string) {
    setLoadingBtn(btnId)
    try {
      const text = await fetchCSV(url)
      const data = parseResponse(text)
      if (!data.length) { alert('No data found'); return }
      setRows(data); setOrig(JSON.parse(JSON.stringify(data)))
      setMods(new Set()); setWeekStart(ws)
      setFb(countryName.replace(/\s+/g, '-').toLowerCase() + '-lr-dealers')
      setScreen('editor')
      if (data.length) setCur(data[0].id)
    } catch (e) { alert('Failed: ' + (e as Error).message) }
    finally { setLoadingBtn(null) }
  }

  function loadFromFile(f: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const data = parseResponse(text)
      if (!data.length) { alert('No data found'); return }
      setRows(data); setOrig(JSON.parse(JSON.stringify(data)))
      setMods(new Set()); setFb(f.name.replace(/\.csv$/i, ''))
      setScreen('editor')
      if (data.length) setCur(data[0].id)
    }
    reader.readAsText(f)
  }

  function markMod(id: string, updated: Retailer) {
    const o = orig.find(r => r.id === id)
    const same = o && COLS.every(c => (updated[c] || '') === (o[c] || ''))
    setMods(prev => { const s = new Set(prev); if (same) s.delete(id); else s.add(id); return s })
  }

  function updateRow(id: string, field: string, val: string) {
    setRows(prev => {
      const next = prev.map(r => r.id === id ? { ...r, [field]: val } : r)
      const updated = next.find(r => r.id === id)!
      markMod(id, updated)
      return next
    })
  }

  function resetRow(id: string) {
    const o = orig.find(r => r.id === id)
    if (!o) return
    setRows(prev => prev.map(r => r.id === id ? { ...JSON.parse(JSON.stringify(o)) } : r))
    setMods(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  function exportCSV() {
    const csv = [COLS.join(','), ...rows.map(r => COLS.map(c => { const v = String(r[c] ?? ''); return /[,"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v }).join(','))].join('\r\n')
    const d = new Date(); const p = (n: number) => String(n).padStart(2, '0')
    const name = `${fb}-edited-${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}.csv`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const curRow = rows.find(r => r.id === cur)
  const filtered = rows.filter(r => {
    const tc = (r.tag_class || '').toLowerCase()
    const n = r.name.toLowerCase(), c = r.city.toLowerCase()
    const searchOk = !srch || n.includes(srch) || c.includes(srch)
    if (filt === 'sales') return searchOk && !tc.includes('service')
    if (filt === 'service') return searchOk && !tc.includes('sales')
    return searchOk
  })
  const cities = [...new Set(filtered.map(r => r.city || 'Other'))].sort()

  function readDay(dayIdx: number): string {
    // Simple read from curRow
    if (!curRow) return 'CLOSED'
    return curRow[`day_${dayIdx + 1}`] || 'CLOSED'
  }

  const iS: React.CSSProperties = { width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', fontFamily: "'Inter',sans-serif", fontSize: '0.72rem', padding: '0.45rem 0.7rem', outline: 'none' }

  if (screen === 'load') return (
    <div style={{ paddingTop: 60 }}>
      <TopNav />
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Retailer Locator Editor</h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Select a market and language to load data, or drag & drop a CSV</p>
        </div>

        {/* Country grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8, marginBottom: 28 }}>
          {COUNTRIES.map(c => (
            <div key={c.name} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 18 }}>{c.flag}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.weekStart === 1 ? 'var(--accent)' : 'var(--orange)', flexShrink: 0 }} title={c.weekStart === 1 ? 'Mon-first' : 'Sun-first'} />
              </div>
              <div style={{ display: 'flex', gap: 4, padding: '8px 12px', flexWrap: 'wrap' }}>
                {c.lr.map(l => {
                  const btnId = `${c.name}-${l.disp}`
                  const loading = loadingBtn === btnId
                  return (
                    <button key={l.disp} disabled={!!loadingBtn} onClick={() => loadFromUrl(l.url, c.name, c.weekStart, btnId)}
                      style={{ padding: '4px 10px', borderRadius: 5, fontSize: '0.66rem', fontWeight: 700, border: '1px solid var(--border)', background: 'var(--surface-2)', color: loading ? 'var(--accent)' : 'var(--text-2)', cursor: loadingBtn ? 'wait' : 'pointer', transition: 'all .15s' }}>
                      {loading ? '…' : l.disp}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Upload zone */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginBottom: 12 }}>Or upload a CSV file manually</p>
          <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFromFile(f) }}
            onClick={() => fileRef.current?.click()}
            style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '2.5rem', cursor: 'pointer', display: 'inline-block', minWidth: 320 }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>Drop dealers.csv here</p>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) loadFromFile(f) }} />
          </div>
        </div>

        {/* Backup All Markets — bottom of page */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>📦 Backup All Markets</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>Download all markets as named CSVs in a zip (e.g. LRDX-UAE-EN.csv)</div>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={() => backupAllMarkets('LRDX')} disabled={!!backupProgress}
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-brd)', borderRadius: 6, color: 'var(--accent)', padding: '6px 14px', cursor: backupProgress ? 'not-allowed' : 'pointer', opacity: backupProgress ? .5 : 1, fontSize: '0.68rem', fontWeight: 700, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              🏔 LRDX Backup
            </button>
            <button onClick={() => backupAllMarkets('RR')} disabled={!!backupProgress}
              style={{ background: 'var(--gold-dim)', border: '1px solid rgba(201,169,110,.4)', borderRadius: 6, color: 'var(--gold)', padding: '6px 14px', cursor: backupProgress ? 'not-allowed' : 'pointer', opacity: backupProgress ? .5 : 1, fontSize: '0.68rem', fontWeight: 700, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              🏔 RR Backup
            </button>
            <button onClick={() => backupAllMarkets('JDX')} disabled={!!backupProgress}
              style={{ background: 'var(--red-dim)', border: '1px solid rgba(232,66,74,.35)', borderRadius: 6, color: 'var(--red)', padding: '6px 14px', cursor: backupProgress ? 'not-allowed' : 'pointer', opacity: backupProgress ? .5 : 1, fontSize: '0.68rem', fontWeight: 700, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              🏔 JDX Backup
            </button>
            <button onClick={backupAll} disabled={!!backupProgress}
              className="btn-primary" style={{ fontSize: '0.68rem', padding: '6px 14px', opacity: backupProgress ? .5 : 1, cursor: backupProgress ? 'not-allowed' : 'pointer' }}>
              📦 All Brands
            </button>
          </div>
          {backupProgress && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-3)', marginBottom: 5 }}>
                <span>{backupProgress.msg}</span>
                <span>{backupProgress.done}/{backupProgress.total}</span>
              </div>
              <div style={{ background: 'var(--surface-3)', borderRadius: 3, height: 4, overflow: 'hidden' }}>
                <div className="backup-progress" style={{ width: `${(backupProgress.done / backupProgress.total) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )

  return (
    <div style={{ paddingTop: 60, display: 'flex', height: '100vh', flexDirection: 'column' }}>
      <TopNav />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', marginTop: 60 }}>
        {/* Sidebar */}
        <div style={{ width: 280, minWidth: 280, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <input className="field-input" placeholder="Search locations…" value={srch} onChange={e => setSrch(e.target.value.toLowerCase())} />
            <div style={{ display: 'flex', gap: 4, marginTop: 7, flexWrap: 'wrap' }}>
              {['all','sales','service'].map(f => (
                <button key={f} onClick={() => setFilt(f)}
                  style={{ padding: '2px 9px', borderRadius: 100, fontSize: '0.62rem', fontWeight: 600, border: '1px solid var(--border)', background: filt === f ? 'var(--accent-dim)' : 'none', color: filt === f ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {cities.map(city => (
              <div key={city}>
                <div style={{ padding: '5px 12px 3px', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', background: 'var(--bg)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>{city}</div>
                {filtered.filter(r => (r.city || 'Other') === city).map(r => {
                  const tc = (r.tag_class || '').toLowerCase()
                  const dotColor = tc.includes('service') && tc.includes('sales') ? 'var(--orange)' : tc.includes('service') ? 'var(--blue)' : 'var(--accent)'
                  return (
                    <div key={r.id} onClick={() => setCur(r.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: cur === r.id ? 'var(--surface-2)' : 'transparent', borderLeft: cur === r.id ? '3px solid var(--accent)' : '3px solid transparent' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-3)' }}>ID {r.id}</div>
                      </div>
                      {mods.has(r.id) && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--orange)', flexShrink: 0 }} />}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <div style={{ padding: '9px 12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-3)', fontFamily: 'monospace', flexShrink: 0 }}>
            <span>{rows.length} locations</span>
            {mods.size > 0 && <span style={{ color: 'var(--orange)' }}>{mods.size} modified</span>}
          </div>
        </div>

        {/* Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ height: 46, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 18px', gap: 8, flexShrink: 0 }}>
            <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{curRow?.name || '—'}</span>
            {mods.has(cur || '') && <span style={{ fontSize: '0.6rem', fontWeight: 700, background: 'var(--orange-dim)', color: 'var(--orange)', border: '1px solid rgba(232,151,58,.3)', padding: '2px 8px', borderRadius: 100 }}>● Modified</span>}
            {cur && <button className="btn-ghost" style={{ fontSize: '0.65rem' }} onClick={() => resetRow(cur!)}>↺ Reset</button>}
            <button className="btn-ghost" style={{ fontSize: '0.65rem' }} onClick={() => setScreen('load')}>↑ Load New</button>
            <button className="btn-primary" style={{ fontSize: '0.65rem', padding: '0.3rem 0.85rem' }} onClick={exportCSV}>↓ Export CSV</button>
          </div>

          {curRow ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
              {/* Opening Hours */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Opening Hours
                  <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: '0.55rem', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{weekStart === 1 ? 'Mon-first' : 'Sun-first'} · {DS.join('·')}</span>
                </div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {DS.map((day, di) => {
                    const val = (curRow[`day_${di + 1}`] || '').trim()
                    const closed = val.toUpperCase() === 'CLOSED' || !val
                    const today = new Date().getDay()
                    const isToday = weekStart === 1 ? ((today + 6) % 7) === di : today === di
                    return (
                      <div key={day} style={{ display: 'flex', alignItems: 'flex-start', padding: '9px 14px', borderBottom: di < 6 ? '1px solid var(--border)' : 'none', gap: 11 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, width: 36, flexShrink: 0, paddingTop: 5, color: isToday ? 'var(--accent)' : 'var(--text)' }}>{day}</div>
                        <div style={{ width: 40, flexShrink: 0, paddingTop: 3 }}>
                          <button className={`toggle-btn ${closed ? '' : 'on'}`} onClick={() => updateRow(cur!, `day_${di + 1}`, closed ? '09:00 AM - 06:00 PM' : 'CLOSED')} />
                        </div>
                        <div style={{ flex: 1 }}>
                          {closed ? <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontStyle: 'italic', paddingTop: 4 }}>Closed</div>
                            : <input style={iS} value={val} onChange={e => updateRow(cur!, `day_${di + 1}`, e.target.value)} placeholder="09:00 AM - 06:00 PM" />}
                        </div>
                      </div>
                    )
                  })}
                  {/* Quick fill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', background: 'var(--bg)', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-3)', flexShrink: 0, marginRight: 2 }}>Quick fill:</span>
                    <button className="btn-ghost" style={{ fontSize: '0.62rem', padding: '3px 9px' }} onClick={() => { const v = curRow['day_1']; for (let d = 2; d <= 7; d++) { if ((curRow[`day_${d}`] || '').toUpperCase() !== 'CLOSED') updateRow(cur!, `day_${d}`, v) } }}>Copy day 1 → all open</button>
                    <button className="btn-ghost" style={{ fontSize: '0.62rem', padding: '3px 9px' }} onClick={() => { for (let d = 1; d <= 7; d++) updateRow(cur!, `day_${d}`, '09:00 AM - 06:00 PM') }}>All week 9–6</button>
                    <button className="btn-ghost" style={{ fontSize: '0.62rem', padding: '3px 9px', marginLeft: 'auto', color: 'var(--red)' }} onClick={() => { for (let d = 1; d <= 7; d++) updateRow(cur!, `day_${d}`, 'CLOSED') }}>All closed</button>
                  </div>
                </div>
              </div>

              {/* Location Details */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>Location Details <span style={{ flex: 1, height: 1, background: 'var(--border)' }} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div><label style={{ fontSize: '0.54rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Name</label>
                    <input style={iS} value={curRow.name || ''} onChange={e => updateRow(cur!, 'name', e.target.value)} /></div>
                  <div><label style={{ fontSize: '0.54rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Address</label>
                    <textarea style={{ ...iS, resize: 'vertical', minHeight: 50 }} value={curRow.address || ''} onChange={e => updateRow(cur!, 'address', e.target.value)} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                    <div><label style={{ fontSize: '0.54rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>City</label><input style={iS} value={curRow.city || ''} onChange={e => updateRow(cur!, 'city', e.target.value)} /></div>
                    <div><label style={{ fontSize: '0.54rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Phone</label><input style={{ ...iS, fontFamily: 'monospace' }} value={curRow.phone || ''} onChange={e => updateRow(cur!, 'phone', e.target.value)} /></div>
                  </div>
                  <div><label style={{ fontSize: '0.54rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Email</label><input style={{ ...iS, fontFamily: 'monospace' }} value={curRow.email || ''} onChange={e => updateRow(cur!, 'email', e.target.value)} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                    <div><label style={{ fontSize: '0.54rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>CTA / www</label><input style={{ ...iS, fontFamily: 'monospace' }} value={curRow.www || ''} onChange={e => updateRow(cur!, 'www', e.target.value)} /></div>
                    <div><label style={{ fontSize: '0.54rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Google Maps URL</label><input style={{ ...iS, fontFamily: 'monospace' }} value={curRow.additional_www || ''} onChange={e => updateRow(cur!, 'additional_www', e.target.value)} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 9 }}>
                    {['lat','lng','position','headlineid'].map(f => (
                      <div key={f}><label style={{ fontSize: '0.54rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>{f}</label><input style={{ ...iS, fontFamily: 'monospace' }} value={curRow[f] || ''} onChange={e => updateRow(cur!, f, e.target.value)} /></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span style={{ fontSize: '0.82rem', color: 'var(--text)' }}>Select a location</span>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
