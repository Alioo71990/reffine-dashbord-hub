import { useEffect, useState, useRef } from 'react'
import { useAdmin } from '../store'
import { fetchWithProxy, parseCSV } from '../lib/csvProxy'

interface TaskRow {
  task: string; status: string; comment: string; url: string
  specialist: string; deadline: string; jira: string
}

interface SheetTab { label: string; url: string }

const PALETTE = ['#e91e8c','#5b8dee','#e8973a','#9b7ee8','#e8424a','#c9a96e','#22c55e','#f472b6','#38bdf8']
const specMap = new Map<string, string>()
let specIdx = 0
function specColor(n: string) {
  const k = n.trim().toLowerCase(); if (!k) return '#8a8e9c'
  if (!specMap.has(k)) { specMap.set(k, PALETTE[specIdx % PALETTE.length]); specIdx++ }
  return specMap.get(k)!
}

function statusStyle(s: string) {
  const k = (s || '').toLowerCase().trim()
  if (k.includes('in progress')) return { bg:'rgba(232,151,58,.14)', brd:'rgba(232,151,58,.45)', color:'#e8973a' }
  if (k.includes('done'))        return { bg:'rgba(34,197,94,.12)',  brd:'rgba(34,197,94,.4)',   color:'#22c55e' }
  if (k.includes('blocked'))     return { bg:'rgba(232,66,74,.13)',  brd:'rgba(232,66,74,.4)',   color:'#e8424a' }
  if (k.includes('review'))      return { bg:'rgba(91,141,238,.13)', brd:'rgba(91,141,238,.4)',  color:'#5b8dee' }
  return { bg:'rgba(138,142,156,.1)', brd:'rgba(138,142,156,.3)', color:'#8a8e9c' }
}

// Auto-detect current month tab index (0-based)
function currentMonthTabIndex(tabs: SheetTab[]): number {
  const now = new Date()
  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december']
  const curMonth = monthNames[now.getMonth()]
  const curYear = String(now.getFullYear())
  // Try to match by month name + year
  for (let i = 0; i < tabs.length; i++) {
    const l = tabs[i].label.toLowerCase()
    if (l.includes(curMonth) && l.includes(curYear)) return i
  }
  // Try month name only
  for (let i = 0; i < tabs.length; i++) {
    if (tabs[i].label.toLowerCase().includes(curMonth)) return i
  }
  // Try month number (e.g. "3" = March)
  for (let i = 0; i < tabs.length; i++) {
    const l = tabs[i].label.toLowerCase()
    const nums = l.match(/\d+/)
    if (nums && parseInt(nums[0]) === now.getMonth() + 1) return i
  }
  return 0
}

export function ContentTasks() {
  const { config } = useAdmin()
  const [rows, setRows] = useState<TaskRow[]>([])
  const [filtered, setFiltered] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(false)
  const [lastSync, setLastSync] = useState<number | null>(null)
  const [fStatus, setFStatus] = useState('')
  const [fSpec, setFSpec] = useState('')
  const [fSearch, setFSearch] = useState('')
  const [tabs, setTabs] = useState<SheetTab[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const intervalRef = useRef<number>(0)

  // Parse tabs from config — support JSON array or single URL
  useEffect(() => {
    const raw = config.tasksCsvUrl || ''
    let parsed: SheetTab[] = []
    try {
      const j = JSON.parse(raw)
      if (Array.isArray(j)) {
        parsed = j.map((item: unknown) => {
          if (typeof item === 'string') return { label: item, url: item }
          const o = item as Record<string,string>
          return { label: o.label || o.name || o.url || 'Sheet', url: o.url || o.csv || '' }
        }).filter((t: SheetTab) => t.url)
      }
    } catch {
      if (raw.startsWith('http')) parsed = [{ label: 'Tasks', url: raw }]
    }
    if (!parsed.length && raw.startsWith('http')) parsed = [{ label: 'Tasks', url: raw }]
    setTabs(parsed)
    // Auto-select current month tab
    const idx = currentMonthTabIndex(parsed)
    setActiveTab(idx)
  }, [config.tasksCsvUrl])

  const csvUrl = tabs[activeTab]?.url || ''

  function applyFilters(r: TaskRow[], fs: string, fsp: string, fq: string) {
    return r.filter(row => {
      const ok1 = !fs || (row.status || '').toLowerCase().includes(fs.toLowerCase())
      const ok2 = !fsp || (row.specialist || '').toLowerCase().includes(fsp.toLowerCase())
      const ok3 = !fq || (row.task + row.comment + row.specialist).toLowerCase().includes(fq)
      return ok1 && ok2 && ok3
    })
  }

  async function load(url = csvUrl) {
    if (!url) return
    setLoading(true)
    try {
      const text = await fetchWithProxy(url)
      const parsedCsv = parseCSV(text)
      if (!parsedCsv || parsedCsv.length < 2) { setRows([]); setFiltered([]); return }

      let headerRowIdx = 0
      for (let hi = 0; hi < Math.min(parsedCsv.length, 5); hi++) {
        if (parsedCsv[hi].join('').toLowerCase().includes('task')) { headerRowIdx = hi; break }
      }
      const hdrs = parsedCsv[headerRowIdx].map(h => h.toLowerCase().trim())
      function colIdx(candidates: string[]) {
        for (const c of candidates) { const i = hdrs.indexOf(c); if (i !== -1) return i }
        for (const c of candidates) { for (let j = 0; j < hdrs.length; j++) { if (hdrs[j].includes(c)) return j } }
        return -1
      }
      const iTask    = colIdx(['task','title'])
      const iStatus  = colIdx(['current status','status'])
      const iComment = colIdx(['comment','comments','notes'])
      const iUrl     = colIdx(['urls','url','link'])
      const iSpec    = colIdx(['asigned specialist','assigned specialist','specialist','assignee'])
      const iDeadline= colIdx(['deadline','due date','due'])
      const iJira    = colIdx(['jira ticket','jira','ticket'])

      const data = parsedCsv.slice(headerRowIdx + 1).map(c => ({
        task: c[iTask] || '', status: c[iStatus] || '', comment: c[iComment] || '',
        url: c[iUrl] || '', specialist: c[iSpec] || '', deadline: c[iDeadline] || '', jira: c[iJira] || ''
      })).filter(r => r.task.trim().length > 0)

      setRows(data)
      setFiltered(applyFilters(data, fStatus, fSpec, fSearch))
      setLastSync(Date.now())
    } catch (e) { console.error('TT load error:', e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!csvUrl) return
    setRows([]); setFiltered([])
    load(csvUrl)
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => load(csvUrl), 5 * 60 * 1000) as unknown as number
    return () => clearInterval(intervalRef.current)
  }, [csvUrl])

  useEffect(() => {
    setFiltered(applyFilters(rows, fStatus, fSpec, fSearch))
  }, [fStatus, fSpec, fSearch, rows])

  const total  = rows.length
  const done   = rows.filter(r => (r.status||'').toLowerCase().includes('done')).length
  const inProg = rows.filter(r => (r.status||'').toLowerCase().includes('in progress')).length
  const pct    = total ? Math.round(done / total * 100) : 0
  const specs  = [...new Set(rows.map(r => r.specialist.trim()).filter(Boolean))].sort()
  const syncLabel = lastSync ? (() => {
    const d = new Date(lastSync)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  })() : null

  const thS: React.CSSProperties = {
    padding:'7px 10px', fontSize:'.54rem', fontWeight:700, letterSpacing:'.1em',
    textTransform:'uppercase' as const, color:'var(--text-3)',
    background:'var(--surface-2)', borderBottom:'1px solid var(--border)',
    textAlign:'left' as const, whiteSpace:'nowrap' as const,
    position:'sticky' as const, top:0, zIndex:2
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', paddingBottom:8, borderBottom:'1px solid var(--border)', marginBottom:8, flexShrink:0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <span style={{ fontSize:'.72rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--text)' }}>Content Tasks</span>
        {loading && <span style={{ color:'var(--orange)', fontSize:'.58rem', display:'flex', alignItems:'center', gap:4 }}>
          <svg className="spinner" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 12a9 9 0 1 0 9-9A9.75 9.75 0 0 0 3.6 5.1L3 8"/><path d="M3 3v5h5"/></svg>
          Loading…</span>}
        {!loading && syncLabel && <span style={{ color:'var(--text-3)', fontSize:'.55rem' }}>↻ {syncLabel}</span>}
        <button onClick={() => load(csvUrl)} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:4, fontSize:'.6rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit', background:'var(--surface-2)', border:'1px solid var(--border)', color:'var(--text-2)' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9A9.75 9.75 0 0 0 3.6 5.1L3 8"/><path d="M3 3v5h5"/></svg>
          Refresh
        </button>
      </div>

      {/* Sheet tabs — only shown if multiple */}
      {tabs.length > 1 && (
        <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none', flexShrink:0, flexWrap:'nowrap' }}>
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setActiveTab(i)}
              style={{ padding:'3px 11px', borderRadius:20, border:'1px solid', cursor:'pointer', fontFamily:'inherit', fontSize:'0.62rem', fontWeight:600, whiteSpace:'nowrap', flexShrink:0, transition:'all .15s',
                background: activeTab === i ? 'var(--accent-dim)' : 'var(--surface-2)',
                borderColor: activeTab === i ? 'var(--accent-brd)' : 'var(--border)',
                color: activeTab === i ? 'var(--accent)' : 'var(--text-3)' }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={{ display:'flex', gap:6, marginBottom:8, flexShrink:0 }}>
        {[{ n:total, label:'Total', color:'var(--text-2)', fv:'' }, { n:inProg, label:'In Progress', color:'var(--orange)', fv:'in progress' }, { n:done, label:'Done', color:'var(--green)', fv:'done' }].map(({ n, label, color, fv }) => (
          <div key={label} onClick={() => setFStatus(fStatus === fv && fv ? '' : fv)}
            style={{ background: fv && fStatus===fv ? `${color}22` : 'var(--surface-2)', border:`1px solid ${fv && fStatus===fv ? color+'66' : 'var(--border)'}`, borderRadius:6, padding:'7px 10px', minWidth:56, textAlign:'center', flexShrink:0, cursor: fv ? 'pointer' : 'default', transition:'all .15s' }}>
            <div style={{ fontSize:'1rem', fontWeight:700, color, lineHeight:1 }}>{n}</div>
            <div style={{ fontSize:'.5rem', fontWeight:600, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--text-3)', marginTop:2 }}>{label}</div>
          </div>
        ))}
        <div style={{ flex:1, background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:6, padding:'7px 10px', display:'flex', flexDirection:'column', gap:5, justifyContent:'center' }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:'.52rem', fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', color:'var(--text-3)' }}>Progress</span>
            <span style={{ fontSize:'.7rem', fontWeight:700, color:'var(--accent)' }}>{pct}%</span>
          </div>
          <div style={{ height:4, background:'var(--surface-3)', borderRadius:2, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${pct}%`, background:'var(--accent-grad)', borderRadius:2, transition:'width .5s' }} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:8, flexShrink:0, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:130, position:'relative' }}>
          <svg style={{ position:'absolute', left:7, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--text-3)' }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="tt-search-input" type="text" placeholder="Search…" value={fSearch} onChange={e => setFSearch(e.target.value.toLowerCase().trim())} style={{ width:'100%' }} />
        </div>
        <select className="tt-filter-sel" value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="in progress">In Progress</option>
          <option value="done">Done</option>
          <option value="blocked">Blocked</option>
        </select>
        <select className="tt-filter-sel" value={fSpec} onChange={e => setFSpec(e.target.value)}>
          <option value="">All People</option>
          {specs.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontSize:'.6rem', color:'var(--text-3)', whiteSpace:'nowrap' }}>{filtered.length}/{total}</span>
      </div>

      {/* Table */}
      <div style={{ flex:1, minHeight:0, overflowY:'auto', border:'1px solid var(--border)', borderRadius:6 }}>
        {loading && !rows.length ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:100, gap:8, color:'var(--text-3)', fontSize:'.72rem' }}>
            <svg className="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9A9.75 9.75 0 0 0 3.6 5.1L3 8"/><path d="M3 3v5h5"/></svg>
            Loading tasks…
          </div>
        ) : !filtered.length ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:100, gap:6, color:'var(--text-3)', fontSize:'.7rem' }}>
            {rows.length ? 'No tasks match your filters' : 'No tasks loaded — click Refresh'}
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thS, width:'30%' }}>Task</th>
                <th style={{ ...thS, width:'11%' }}>Status</th>
                <th style={{ ...thS, width:'27%' }}>Comment</th>
                <th style={{ ...thS, width:'12%' }}>Specialist</th>
                <th style={{ ...thS, width:'8%' }}>Deadline</th>
                <th style={{ ...thS, width:'12%' }}>Links</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const st = statusStyle(r.status)
                const isDone = (r.status||'').toLowerCase().includes('done')
                const sc = specColor(r.specialist)
                return (
                  <tr key={i} style={{ background: i%2===0 ? 'var(--surface)' : 'transparent', borderBottom:'1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='var(--accent-dim)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i%2===0 ? 'var(--surface)' : 'transparent'}>
                    <td style={{ padding:'9px 10px', verticalAlign:'top' }}>
                      <div style={{ fontSize:'.69rem', fontWeight:600, color: isDone ? 'var(--text-3)' : 'var(--text)', lineHeight:1.4, textDecoration: isDone ? 'line-through' : 'none' }}>{r.task}</div>
                    </td>
                    <td style={{ padding:'9px 10px', verticalAlign:'top', whiteSpace:'nowrap' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:20, fontSize:'.58rem', fontWeight:700, background:st.bg, border:`1px solid ${st.brd}`, color:st.color }}>
                        <span style={{ width:5, height:5, borderRadius:'50%', background:st.color, flexShrink:0 }} />
                        {r.status || '—'}
                      </span>
                    </td>
                    <td style={{ padding:'9px 10px', verticalAlign:'top' }}>
                      <div style={{ fontSize:'.62rem', color:'var(--text-2)', lineHeight:1.55, maxHeight:54, overflow:'hidden' }}>
                        {(r.comment||'').slice(0,140)}{r.comment.length>140?'…':''}
                      </div>
                    </td>
                    <td style={{ padding:'9px 10px', verticalAlign:'top', whiteSpace:'nowrap' }}>
                      {r.specialist.trim()
                        ? <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:'.6rem', fontWeight:700, background:`${sc}18`, border:`1px solid ${sc}44`, color:sc }}>{r.specialist}</span>
                        : <span style={{ color:'var(--text-3)', fontSize:'.6rem' }}>—</span>}
                    </td>
                    <td style={{ padding:'9px 10px', verticalAlign:'top', fontSize:'.63rem', color: r.deadline ? 'var(--gold)' : 'var(--text-3)', whiteSpace:'nowrap' }}>
                      {r.deadline || '—'}
                    </td>
                    <td style={{ padding:'9px 10px', verticalAlign:'top' }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        {r.jira?.trim() && (
                          <a href={r.jira} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:4, fontSize:'.55rem', fontWeight:700, background:'rgba(91,141,238,.12)', border:'1px solid rgba(91,141,238,.3)', color:'#5b8dee', textDecoration:'none', whiteSpace:'nowrap' }}>
                            {(r.jira.match(/[A-Z]+-\d+/) || ['JIRA'])[0]}
                          </a>
                        )}
                        {r.url?.trim() && (
                          <a href={r.url} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:4, fontSize:'.55rem', fontWeight:700, background:'var(--accent-dim)', border:'1px solid var(--accent-brd)', color:'var(--accent)', textDecoration:'none', whiteSpace:'nowrap' }}>
                            URL
                          </a>
                        )}
                        {!r.jira && !r.url && <span style={{ color:'var(--text-3)', fontSize:'.6rem' }}>—</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
