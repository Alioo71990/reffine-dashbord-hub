import { useState, useRef } from 'react'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'
import Papa from 'papaparse'

interface SeoReport { filename: string; type: string; enriched: any[] }

const CONTENT: Record<string, any> = {
  '404': {
    title: '404 — Broken Pages',
    what: 'These URLs return a 404 error — your site has links pointing to pages that no longer exist.',
    playbook: [
      { level: 'high', n: '1', title: 'High inlinks (50+) → Add a 301 redirect immediately', desc: 'Set up a 301 redirect from the broken URL to the best matching live page.' },
      { level: 'medium', n: '2', title: 'Fix the source link on "First found at"', desc: 'Update the actual link on the source page to point directly to the new live URL.' },
      { level: 'low', n: '3', title: 'Zero inlinks → Low priority', desc: 'Ensure no navigation or sitemap leads to this URL.' },
    ]
  },
  'broken': {
    title: 'Broken Redirects (301→404)',
    what: 'These redirects send traffic to a destination that returns 404.',
    playbook: [
      { level: 'high', n: '1', title: 'Fix the redirect destination', desc: 'Either publish the destination page or update the redirect to point to a live page.' },
      { level: 'medium', n: '2', title: 'Update internal links to the final URL', desc: 'Always link directly to the final 200 URL, never to a redirecting URL.' },
    ]
  },
  'chain': {
    title: 'Redirect Chains',
    what: 'Reaching the final page requires 2+ redirects — each extra hop wastes crawl budget.',
    playbook: [
      { level: 'high', n: '1', title: 'Collapse to 1 hop: first URL → final URL', desc: 'Update the redirect rule so URL #1 points directly to the last 200 page.' },
      { level: 'medium', n: '2', title: 'Update internal links to the final URL', desc: 'Link directly to the final destination, never through a redirect chain.' },
    ]
  },
  'hreflang': {
    title: 'Hreflang Issues',
    what: 'Hreflang tags tell Google which language/country version to serve. Broken targets are ignored.',
    playbook: [
      { level: 'high', n: '1', title: 'Replace 301/404 hreflang targets with final 200 URLs', desc: 'Every hreflang URL must be a live 200 page.' },
      { level: 'medium', n: '2', title: 'Add the missing self-referencing tag', desc: 'Every page must have a hreflang tag pointing back to itself.' },
    ]
  }
}

function detectType(headers: string[], rows: any[]): string {
  const h = headers.map(x => x.toLowerCase())
  if (h.includes('hreflang links') || h.some(x => x.includes('hreflang'))) return 'hreflang'
  if (h.some(x => x.includes('redirect chain'))) return 'chain'
  if (h.includes('redirect url') && rows.slice(0, 30).some(r => r['HTTP status code'] === '404' || r['Redirect URL code'] === '404')) return 'broken'
  if (rows.slice(0, 30).some(r => r['HTTP status code'] === '404')) return '404'
  return 'unknown'
}

function priority(type: string, row: any): string {
  const il = parseInt(row['No. of all inlinks'] || '0') || 0
  if (type === '404') return il >= 200 ? 'CRITICAL' : il >= 50 ? 'HIGH' : il >= 10 ? 'MEDIUM' : 'LOW'
  if (type === 'broken') return il >= 100 ? 'CRITICAL' : il >= 10 ? 'HIGH' : 'MEDIUM'
  if (type === 'chain') { const h = parseInt(row['No. of redirect chain URLs'] || '0') || 0; return h >= 4 ? 'HIGH' : h >= 2 ? 'MEDIUM' : 'LOW' }
  if (type === 'hreflang') { const i = (row['Hreflang issues'] || '').toLowerCase(); return (i.includes('404') || i.includes('301')) ? 'HIGH' : i ? 'MEDIUM' : 'LOW' }
  return 'LOW'
}

function generateFix(type: string, row: any): string {
  if (type === '404') {
    const fa = (row['First found at'] || '').split('\n')[0]
    const il = parseInt(row['No. of all inlinks'] || '0') || 0
    if (il === 0) return 'No internal links point here. Verify if the page should exist; if not, leave the 404.'
    if (fa) return `Fix the broken link on "${fa.slice(0, 80)}" — then add a 301 redirect to the best matching live page.`
    return 'Add a 301 redirect to the closest matching live page and update internal links.'
  }
  if (type === 'broken') return `Redirect destination ${row['Redirect URL'] || ''} returns ${row['Redirect URL code'] || '404'}. Update the redirect rule to point to a live page.`
  if (type === 'chain') {
    const chain = (row['Redirect chain URLs'] || '').split('\n').filter(Boolean)
    const final = chain[chain.length - 1] || row['Redirect URL'] || '(see chain)'
    return `${row['No. of redirect chain URLs'] || chain.length}-hop chain. Update first redirect to jump directly to: ${final.slice(0, 80)}`
  }
  if (type === 'hreflang') {
    const issues = (row['Hreflang issues'] || '').replace(/\n/g, ' · ')
    return issues ? `Issues: ${issues.slice(0, 200)}. Use final 200 URLs only, add self-referencing tag, add x-default.` : 'Verify all hreflang targets return 200.'
  }
  return 'Review this row manually.'
}

const PRIO_COLORS: Record<string, string> = { CRITICAL: '#e8424a', HIGH: '#e8973a', MEDIUM: '#5b8dee', LOW: '#8a8e9c' }
const PRIO_BG: Record<string, string> = { CRITICAL: 'rgba(232,66,74,.12)', HIGH: 'rgba(232,151,58,.12)', MEDIUM: 'rgba(91,141,238,.12)', LOW: 'rgba(138,142,156,.1)' }

export function SEOToolPage() {
  const [reports, setReports] = useState<SeoReport[]>([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const [fixed, setFixed] = useState<Map<number, Set<string>>>(new Map())
  const [search, setSearch] = useState('')
  const [pFilter, setPFilter] = useState('')
  const [showFixedRows, setShowFixedRows] = useState(true)
  const [page, setPage] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const PAGE_SIZE = 50

  function loadFile(f: File) {
    Papa.parse(f, {
      header: true, skipEmptyLines: true, quoteChar: '"',
      complete: (res) => {
        const headers = res.meta.fields || []
        const rows = res.data as any[]
        const type = detectType(headers, rows)
        const pOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
        const enriched = rows.map(row => ({
          ...row, _priority: priority(type, row), _fix: generateFix(type, row)
        })).sort((a, b) => (pOrder[a._priority] || 3) - (pOrder[b._priority] || 3))
        const idx = reports.length
        setReports(prev => [...prev, { filename: f.name, type, enriched }])
        setFixed(prev => { const m = new Map(prev); m.set(idx, new Set()); return m })
        setActiveIdx(idx); setPage(1)
      }
    })
  }

  const activeReport = reports[activeIdx]
  const fixedSet = fixed.get(activeIdx) || new Set<string>()

  function rowKey(row: any, i: number): string { return (row.URL || '') + '||' + i }

  function toggleFixed(key: string) {
    setFixed(prev => {
      const m = new Map(prev)
      const s = new Set(m.get(activeIdx) || [])
      if (s.has(key)) s.delete(key); else s.add(key)
      m.set(activeIdx, s); return m
    })
  }

  function getFiltered() {
    if (!activeReport) return []
    return activeReport.enriched.map((row, i) => ({ row, key: rowKey(row, i) })).filter(({ row, key }) => {
      if (!showFixedRows && fixedSet.has(key)) return false
      if (search && !JSON.stringify(row).toLowerCase().includes(search)) return false
      if (pFilter && row._priority !== pFilter) return false
      return true
    })
  }

  const filtered = getFiltered()
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    ;[...e.dataTransfer.files].filter(f => f.name.endsWith('.csv')).forEach(loadFile)
  }

  return (
    <div style={{ paddingTop: 60, display: 'flex', height: '100vh', flexDirection: 'column' }}>
      <TopNav />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', marginTop: 60 }}>
        {/* Sidebar */}
        <div style={{ width: 240, minWidth: 240, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Loaded Files</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {!reports.length && <div style={{ padding: '1rem', color: 'var(--text-3)', fontSize: '0.68rem' }}>No files yet.</div>}
            {reports.map((r, i) => {
              const c = CONTENT[r.type] || { title: 'Unknown' }
              const fset = fixed.get(i) || new Set()
              const pct = r.enriched.length ? Math.round(fset.size / r.enriched.length * 100) : 0
              return (
                <div key={i} onClick={() => { setActiveIdx(i); setPage(1) }}
                  style={{ padding: '0.9rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: i === activeIdx ? 'var(--surface-2)' : 'transparent', borderLeft: i === activeIdx ? '3px solid var(--accent)' : '3px solid transparent' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text)', marginBottom: 4, wordBreak: 'break-all', lineHeight: 1.4 }}>{r.filename}</div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 5 }}>{c.title}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.58rem', color: 'var(--text-3)' }}>
                    <span>{r.enriched.length} rows</span><span style={{ color: 'var(--accent)' }}>{fset.size} fixed ({pct}%)</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2 }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)' }}>
            <label style={{ display: 'block', textAlign: 'center', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-brd)', borderRadius: 6, padding: '0.5rem', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>
              + Add CSV files
              <input ref={fileInputRef} type="file" accept=".csv" multiple style={{ display: 'none' }} onChange={e => { [...(e.target.files || [])].forEach(loadFile); e.target.value = '' }} />
            </label>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeIdx === -1 ? (
            <div onDragOver={e => e.preventDefault()} onDrop={handleDrop}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '4rem 6rem', textAlign: 'center', cursor: 'pointer', maxWidth: 480 }}
                onClick={() => fileInputRef.current?.click()}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📂</div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Drop your SEO CSV files here</h2>
                <p style={{ color: 'var(--text-3)', fontSize: '0.78rem', lineHeight: 1.7 }}>404 pages · Broken redirects · Redirect chains · Hreflang issues<br /><br />Report type auto-detected from column headers</p>
              </div>
            </div>
          ) : (
            <div style={{ padding: '1.5rem 1.75rem' }}>
              {/* Title */}
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>{CONTENT[activeReport.type]?.title || 'SEO Report'}</h2>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginBottom: '1.25rem' }}>{activeReport.filename}</div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 10, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {[{ label: 'Total', n: activeReport.enriched.length, color: 'var(--text)' },
                  { label: 'Critical', n: activeReport.enriched.filter(r => r._priority === 'CRITICAL').length, color: '#e8424a' },
                  { label: 'High', n: activeReport.enriched.filter(r => r._priority === 'HIGH').length, color: '#e8973a' },
                  { label: 'Fixed ✓', n: fixedSet.size, color: 'var(--accent)' }
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.8rem 1rem', minWidth: 90, flex: 1 }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.n}</div>
                  </div>
                ))}
              </div>

              {/* What it means */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span>💡</span> What This Report Means
                </div>
                <div style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--text-2)', lineHeight: 1.7 }}>{CONTENT[activeReport.type]?.what || ''}</div>
              </div>

              {/* Playbook */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span>🛠️</span> How To Fix — Playbook
                </div>
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(CONTENT[activeReport.type]?.playbook || []).map((p: any) => (
                    <div key={p.n} style={{ display: 'flex', gap: 12, padding: '0.9rem', borderRadius: 6, borderLeft: `3px solid ${p.level === 'high' ? '#e8424a' : p.level === 'medium' ? '#e8973a' : '#5b8dee'}`, background: p.level === 'high' ? 'rgba(232,66,74,.08)' : p.level === 'medium' ? 'rgba(232,151,58,.08)' : 'rgba(91,141,238,.08)' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-3)', minWidth: 20 }}>{p.n}.</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.78rem', marginBottom: 3 }}>{p.title}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{p.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span>📋</span> All Rows
                </div>
                <div style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <input placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value.toLowerCase()); setPage(1) }}
                      style={{ flex: 1, minWidth: 140, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 11px', fontSize: '0.68rem', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
                    <select value={pFilter} onChange={e => { setPFilter(e.target.value); setPage(1) }} className="field-select" style={{ width: 'auto' }}>
                      <option value="">All priorities</option>
                      <option value="CRITICAL">🔴 Critical</option>
                      <option value="HIGH">🟠 High</option>
                      <option value="MEDIUM">🔵 Medium</option>
                      <option value="LOW">⚪ Low</option>
                    </select>
                    <button className="btn-ghost" style={{ fontSize: '0.68rem', ...(showFixedRows ? {} : { color: 'var(--accent)', borderColor: 'var(--accent-brd)' }) }} onClick={() => setShowFixedRows(!showFixedRows)}>
                      {showFixedRows ? '👁 Showing fixed' : '🙈 Hiding fixed'}
                    </button>
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                      <thead>
                        <tr>
                          {['Assignee','Recommended Fix','URL','Priority','✓'].map(h => (
                            <th key={h} style={{ background: 'var(--surface-2)', padding: '8px 10px', fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map(({ row, key }, i) => {
                          const isFixed = fixedSet.has(key)
                          const pc = PRIO_COLORS[row._priority] || '#8a8e9c'
                          return (
                            <tr key={key} style={{ background: isFixed ? 'rgba(0,208,132,.04)' : i % 2 === 0 ? 'rgba(255,255,255,.012)' : 'transparent', borderBottom: '1px solid var(--border)', opacity: isFixed ? 0.55 : 1 }}>
                              <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 20, fontSize: '0.6rem', fontWeight: 700, background: 'rgba(0,208,132,.1)', border: '1px solid rgba(0,208,132,.25)', color: 'var(--accent)' }}>Dev+SEO</span>
                              </td>
                              <td style={{ padding: '9px 10px', maxWidth: 380, fontSize: '0.68rem', lineHeight: 1.5, color: 'var(--text)', textDecoration: isFixed ? 'line-through' : 'none' }}>{row._fix}</td>
                              <td style={{ padding: '9px 10px', maxWidth: 220 }}>
                                <a href={row.URL} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: '0.62rem', textDecoration: 'none', wordBreak: 'break-all' }}>{(row.URL || '').slice(0, 60)}{(row.URL || '').length > 60 ? '…' : ''}</a>
                              </td>
                              <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                                <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 4, fontSize: '0.58rem', fontWeight: 700, background: PRIO_BG[row._priority] || 'transparent', color: pc }}>{row._priority}</span>
                              </td>
                              <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                                <input type="checkbox" checked={isFixed} onChange={() => toggleFixed(key)} style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }} />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                    <button className="btn-ghost" style={{ fontSize: '0.65rem', padding: '4px 10px' }} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>Page {page} of {totalPages} · {filtered.length} rows</span>
                    <button className="btn-ghost" style={{ fontSize: '0.65rem', padding: '4px 10px' }} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
