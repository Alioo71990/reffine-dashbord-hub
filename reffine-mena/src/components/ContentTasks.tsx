import { useEffect, useState, useRef } from 'react'
import { useAdmin } from '../store'
import { fetchWithProxy, parseCSV } from '../lib/csvProxy'

interface TaskRow {
  task: string; status: string; comment: string; url: string
  specialist: string; deadline: string; jira: string
}

const PALETTE = ['#00d084','#5b8dee','#e8973a','#9b7ee8','#e8424a','#c9a96e','#22c55e','#f472b6','#38bdf8']
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
  if (k.includes('done')) return { bg:'rgba(0,208,132,.12)', brd:'rgba(0,208,132,.4)', color:'#00d084' }
  if (k.includes('blocked')) return { bg:'rgba(232,66,74,.13)', brd:'rgba(232,66,74,.4)', color:'#e8424a' }
  if (k.includes('review')) return { bg:'rgba(91,141,238,.13)', brd:'rgba(91,141,238,.4)', color:'#5b8dee' }
  return { bg:'rgba(138,142,156,.1)', brd:'rgba(138,142,156,.3)', color:'#8a8e9c' }
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
  const intervalRef = useRef<number>(0)

  const csvUrl = config.tasksCsvUrl

  function applyFilters(r: TaskRow[], fs: string, fsp: string, fq: string) {
    return r.filter(row => {
      const ok1 = !fs || (row.status || '').toLowerCase().includes(fs.toLowerCase())
      const ok2 = !fsp || (row.specialist || '').toLowerCase().includes(fsp.toLowerCase())
      const ok3 = !fq || (row.task + row.comment + row.specialist).toLowerCase().includes(fq)
      return ok1 && ok2 && ok3
    })
  }

  async function load() {
    setLoading(true)
    try {
      const text = await fetchWithProxy(csvUrl)
      const parsed = parseCSV(text)
      if (!parsed || parsed.length < 2) return

      let headerRowIdx = 0
      for (let hi = 0; hi < Math.min(parsed.length, 5); hi++) {
        if (parsed[hi].join('').toLowerCase().includes('task')) { headerRowIdx = hi; break }
      }
      const hdrs = parsed[headerRowIdx].map(h => h.toLowerCase().trim())

      function colIdx(candidates: string[]) {
        for (const c of candidates) { const i = hdrs.indexOf(c); if (i !== -1) return i }
        for (const c of candidates) { for (let j = 0; j < hdrs.length; j++) { if (hdrs[j].includes(c)) return j } }
        return -1
      }

      const iTask = colIdx(['task'])
      const iStatus = colIdx(['current status','status'])
      const iComment = colIdx(['comment','comments','notes'])
      const iUrl = colIdx(['urls','url','link'])
      const iSpec = colIdx(['asigned specialist','assigned specialist','specialist','assignee'])
      const iDeadline = colIdx(['deadline','due date','due'])
      const iJira = colIdx(['jira ticket','jira','ticket'])

      const data = parsed.slice(headerRowIdx + 1).map(c => ({
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
    load()
    intervalRef.current = setInterval(load, 5 * 60 * 1000) as unknown as number
    return () => clearInterval(intervalRef.current)
  }, [csvUrl])

  useEffect(() => {
    setFiltered(applyFilters(rows, fStatus, fSpec, fSearch))
  }, [fStatus, fSpec, fSearch, rows])

  const total = rows.length
  const done = rows.filter(r => (r.status||'').toLowerCase().includes('done')).length
  const inProg = rows.filter(r => (r.status||'').toLowerCase().includes('in progress')).length
  const pct = total ? Math.round(done / total * 100) : 0

  const specs = [...new Set(rows.map(r => r.specialist.trim()).filter(Boolean))].sort()

  const syncLabel = lastSync ? (() => {
    const d = new Date(lastSync)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  })() : null

  const thS: React.CSSProperties = { padding:'7px 10px', fontSize:'.54rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'rgba(138,142,156,.55)', background:'#0d0f12', borderBottom:'1px solid rgba(255,255,255,.07)', textAlign:'left' as const, whiteSpace:'nowrap' as const, position:'sticky' as const, top:0, zIndex:2 }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', paddingBottom:10, borderBottom:'1px solid rgba(255,255,255,.07)', marginBottom:10, flexShrink:0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d084" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <span style={{ fontSize:'.72rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--text)' }}>Content Tasks</span>
        {loading && <span style={{ color:'#e8973a', fontSize:'.58rem', display:'flex', alignItems:'center', gap:4 }}>
          <svg style={{ animation:'ttSpin 1s linear infinite' }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 12a9 9 0 1 0 9-9A9.75 9.75 0 0 0 3.6 5.1L3 8"/><path d="M3 3v5h5"/></svg>
          Loading…</span>}
        {!loading && syncLabel && <span style={{ color:'rgba(138,142,156,.5)', fontSize:'.55rem' }}>↻ {syncLabel}</span>}
        <button onClick={load} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:4, fontSize:'.6rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', color:'var(--text-2)' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9A9.75 9.75 0 0 0 3.6 5.1L3 8"/><path d="M3 3v5h5"/></svg>
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'flex', gap:8, marginBottom:10, flexShrink:0 }}>
        {[{ n:total, label:'Total', color:'#8a8e9c', fv:'' }, { n:inProg, label:'In Progress', color:'#e8973a', fv:'in progress' }, { n:done, label:'Done', color:'#00d084', fv:'done' }].map(({ n, label, color, fv }) => (
          <div key={label} onClick={() => setFStatus(fStatus === fv && fv ? '' : fv)}
            style={{ background: fv && fStatus===fv ? `${color}22` : 'rgba(255,255,255,.03)', border:`1px solid ${fv && fStatus===fv ? color+'66' : 'rgba(255,255,255,.07)'}`, borderRadius:6, padding:'8px 12px', minWidth:60, textAlign:'center', flexShrink:0, cursor: fv ? 'pointer' : 'default' }}>
            <div style={{ fontSize:'1rem', fontWeight:700, color, lineHeight:1 }}>{n}</div>
            <div style={{ fontSize:'.52rem', fontWeight:600, letterSpacing:'.07em', textTransform:'uppercase', color:'rgba(138,142,156,.5)', marginTop:2 }}>{label}</div>
          </div>
        ))}
        <div style={{ flex:1, background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:6, padding:'8px 12px', display:'flex', flexDirection:'column', gap:5, justifyContent:'center' }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:'.55rem', fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(138,142,156,.55)' }}>Progress</span>
            <span style={{ fontSize:'.7rem', fontWeight:700, color:'#00d084' }}>{pct}%</span>
          </div>
          <div style={{ height:4, background:'rgba(255,255,255,.07)', borderRadius:2, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#00a86b,#00d084)', borderRadius:2, transition:'width .5s' }} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:10, flexShrink:0, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:130, position:'relative' }}>
          <svg style={{ position:'absolute', left:7, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'rgba(138,142,156,.4)' }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
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
        <span style={{ fontSize:'.6rem', color:'rgba(138,142,156,.4)', whiteSpace:'nowrap' }}>{filtered.length}/{total}</span>
      </div>

      {/* Table */}
      <div style={{ flex:1, minHeight:0, overflowY:'auto', border:'1px solid rgba(255,255,255,.07)', borderRadius:6 }}>
        {loading && !rows.length ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:100, gap:8, color:'rgba(138,142,156,.5)', fontSize:'.72rem' }}>
            <svg style={{ animation:'ttSpin 1s linear infinite' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d084" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9A9.75 9.75 0 0 0 3.6 5.1L3 8"/><path d="M3 3v5h5"/></svg>
            Loading tasks…
          </div>
        ) : !filtered.length ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:100, gap:6, color:'rgba(138,142,156,.35)', fontSize:'.7rem' }}>
            {rows.length ? 'No tasks match your filters' : 'No tasks loaded yet — click Refresh'}
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thS, width:'30%' }}>Task</th>
                <th style={{ ...thS, width:'11%' }}>Status</th>
                <th style={{ ...thS, width:'28%' }}>Comment</th>
                <th style={{ ...thS, width:'12%' }}>Specialist</th>
                <th style={{ ...thS, width:'8%' }}>Deadline</th>
                <th style={{ ...thS, width:'11%' }}>Links</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const even = i % 2 === 0
                const st = statusStyle(r.status)
                const isDone = (r.status||'').toLowerCase().includes('done')
                const sc = specColor(r.specialist)
                return (
                  <tr key={i} style={{ background: even ? 'rgba(255,255,255,.012)' : 'transparent', borderBottom:'1px solid rgba(255,255,255,.04)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(0,208,132,.035)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = even ? 'rgba(255,255,255,.012)' : 'transparent'}>
                    <td style={{ padding:'9px 10px', verticalAlign:'top' }}>
                      <div style={{ fontSize:'.69rem', fontWeight:600, color: isDone ? 'var(--tt-done-color, rgba(240,240,240,.4))' : '#f0f0f0', lineHeight:1.4, textDecoration: isDone ? 'line-through' : 'none' }}>{r.task}</div>
                    </td>
                    <td style={{ padding:'9px 10px', verticalAlign:'top', whiteSpace:'nowrap' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:20, fontSize:'.58rem', fontWeight:700, background:st.bg, border:`1px solid ${st.brd}`, color:st.color }}>
                        <span style={{ width:5, height:5, borderRadius:'50%', background:st.color, flexShrink:0 }} />
                        {r.status || '—'}
                      </span>
                    </td>
                    <td style={{ padding:'9px 10px', verticalAlign:'top' }}>
                      <div style={{ fontSize:'.62rem', color:'rgba(138,142,156,.75)', lineHeight:1.55, maxHeight:54, overflow:'hidden' }}>
                        {(r.comment||'').slice(0, 140)}{r.comment.length > 140 ? '…' : ''}
                      </div>
                    </td>
                    <td style={{ padding:'9px 10px', verticalAlign:'top', whiteSpace:'nowrap' }}>
                      {r.specialist.trim()
                        ? <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:'.6rem', fontWeight:700, background:`${sc}18`, border:`1px solid ${sc}44`, color:sc }}>{r.specialist}</span>
                        : <span style={{ color:'rgba(138,142,156,.3)', fontSize:'.6rem' }}>—</span>}
                    </td>
                    <td style={{ padding:'9px 10px', verticalAlign:'top', fontSize:'.63rem', color: r.deadline ? 'rgba(201,169,110,.85)' : 'rgba(138,142,156,.3)', whiteSpace:'nowrap' }}>
                      {r.deadline || '—'}
                    </td>
                    <td style={{ padding:'9px 10px', verticalAlign:'top' }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {r.jira?.trim() && (
                          <a href={r.jira} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:4, fontSize:'.55rem', fontWeight:700, background:'rgba(91,141,238,.12)', border:'1px solid rgba(91,141,238,.3)', color:'#5b8dee', textDecoration:'none', whiteSpace:'nowrap' }}>
                            {(r.jira.match(/[A-Z]+-\d+/) || ['JIRA'])[0]}
                          </a>
                        )}
                        {r.url?.trim() && (
                          <a href={r.url} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:4, fontSize:'.55rem', fontWeight:700, background:'rgba(0,208,132,.08)', border:'1px solid rgba(0,208,132,.25)', color:'#00d084', textDecoration:'none', whiteSpace:'nowrap' }}>
                            URL
                          </a>
                        )}
                        {!r.jira && !r.url && <span style={{ color:'rgba(138,142,156,.3)', fontSize:'.6rem' }}>—</span>}
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
