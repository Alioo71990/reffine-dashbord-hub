import { useState } from 'react'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'
import { ContentTasks } from '../components/ContentTasks'
import { WeekPlanner } from '../components/WeekPlanner'
import { REGION_GROUPS, SITE_DATA, COUNTRY_FLAGS, RR_CMS_PREFIXES, IMPORTANT_SITES, EMAIL_GROUPS } from '../lib/constants'

type Brand = 'LRDX' | 'RR' | 'JDX'
type Mode = 'live' | 'cms'
type Section = 'sites' | 'important' | 'emails'
type RightTab = 'tasks' | 'planner'

const BRAND_LABELS: Record<Brand, string> = { LRDX: 'Land Rover', RR: 'Range Rover', JDX: 'Jaguar' }
const BRAND_COLORS: Record<Brand, string> = { LRDX: 'var(--accent)', RR: 'var(--gold)', JDX: 'var(--red)' }
const BRAND_HOVER: Record<Brand, string> = { LRDX: 'rgba(0,208,132,.15)', RR: 'rgba(201,169,110,.15)', JDX: 'rgba(232,66,74,.15)' }

function FlagImg({ country }: { country: string }) {
  const code = COUNTRY_FLAGS[country]
  if (!code) return null
  return <img src={`https://flagcdn.com/20x15/${code}.png`} srcSet={`https://flagcdn.com/40x30/${code}.png 2x`} width={20} height={15} alt=""
    style={{ borderRadius: 2, flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,.4)', display: 'block', objectFit: 'cover' }} loading="lazy" />
}

function CountryCard({ country, brand, mode }: { country: string; brand: Brand; mode: Mode }) {
  const links = SITE_DATA[brand]?.[country]
  if (!links) return null
  function getCmsUrl(lang: string, liveUrl: string) {
    if (brand === 'RR') {
      const p = liveUrl.split('/').filter(Boolean).pop()
      return `https://app.${RR_CMS_PREFIXES[country]}-rangerover.lrdx.prod.reffine.com/${p}/cms/`
    }
    return liveUrl + 'cms/'
  }
  return (
    <div className="country-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flexShrink: 1 }}>
        <FlagImg country={country} />
        <span style={{ fontSize: '0.67rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{country}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', justifyContent: 'flex-end', flexShrink: 0 }}>
        {Object.entries(links).map(([lang, url]) => {
          const href = mode === 'cms' ? getCmsUrl(lang, url) : url
          return (
            <a key={lang} href={href} target="_blank" rel="noreferrer" className="link-badge"
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = BRAND_HOVER[brand]; el.style.color = BRAND_COLORS[brand]; el.style.borderColor = BRAND_COLORS[brand] + '44' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = ''; el.style.color = ''; el.style.borderColor = '' }}>
              {lang}
            </a>
          )
        })}
      </div>
    </div>
  )
}

function BrandPanel({ brand, mode, region, search }: { brand: Brand; mode: Mode; region: string; search: string }) {
  return (
    <div>
      {REGION_GROUPS.filter(g => region === 'all' || g.title === region).map(group => {
        const countries = group.countries.filter(c => !search || c.toLowerCase().includes(search))
        if (!countries.length) return null
        return (
          <div key={group.title} style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{group.title}</span>
              <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid rgba(0,208,132,.2)', padding: '0.1rem 0.5rem', borderRadius: 20 }}>{countries.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem' }}>
              {countries.map(c => <CountryCard key={c} country={c} brand={brand} mode={mode} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ImportantSites() {
  return (
    <div>
      <div style={{ marginBottom: '0.75rem', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Resources & Links</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem' }}>
        {IMPORTANT_SITES.map(s => (
          <div key={s.name} className="country-card">
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.name}</span>
            <a href={s.url} target="_blank" rel="noreferrer" className="link-badge"
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--accent-dim)'; el.style.color = 'var(--accent)'; el.style.borderColor = 'var(--accent-brd)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = ''; el.style.color = ''; el.style.borderColor = '' }}>
              Open →
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

function copyText(text: string, btn: HTMLButtonElement, orig: string) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✓ Copied'
    setTimeout(() => { btn.textContent = orig }, 2000)
  }).catch(() => {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    btn.textContent = '✓ Copied'; setTimeout(() => { btn.textContent = orig }, 2000)
  })
}

function EmailTemplates() {
  const template = (greeting: string) =>
    `${greeting}\n\nWe kindly ask for needed translation for update in [Update-name].\nPlease provide them as soon as possible so we can prepare this update.\n\nBest regards,`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {EMAIL_GROUPS.map(g => (
        <div key={g.id} className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', gap: '1rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, display: 'inline-block' }} />
              {g.title}
            </span>
            <button className="btn-ghost" style={{ fontSize: '0.6rem', padding: '0.2rem 0.5rem' }} onClick={e => copyText(g.title, e.currentTarget, 'Copy Title')}>Copy Title</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Template</span>
                <button className="btn-ghost" style={{ fontSize: '0.58rem', padding: '0.15rem 0.4rem' }} onClick={e => copyText(template(g.greeting), e.currentTarget, 'Copy')}>Copy</button>
              </div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.75rem 0.9rem', fontSize: '0.72rem', lineHeight: 1.7, color: 'var(--text-2)', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                {template(g.greeting)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '0.4rem' }}>Recipients</div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                {([{ label: 'To', items: g.to, action: () => g.to.map(r => `${r.name} <${r.email}>`).join(', ') },
                   { label: 'CC', items: g.cc, action: () => g.cc.map(r => `${r.name} <${r.email}>`).join(', ') }] as const)
                  .map(({ label, items, action }) => (
                  <div key={label} style={{ padding: '0.65rem 0.9rem', borderBottom: label === 'To' ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{label}</span>
                      <button className="btn-ghost" style={{ fontSize: '0.56rem', padding: '0.12rem 0.4rem' }} onClick={e => copyText(action(), e.currentTarget, `Copy ${label}`)}>Copy {label}</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {items.map(r => (
                        <span key={r.email} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '0.18rem 0.5rem', fontSize: '0.65rem', color: 'var(--text-2)', wordBreak: 'break-word' }}>{r.name}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardPage() {
  const [brand, setBrand] = useState<Brand>('LRDX')
  const [mode, setMode] = useState<Mode>('live')
  const [region, setRegion] = useState('all')
  const [search, setSearch] = useState('')
  const [section, setSection] = useState<Section>('sites')
  const [rightTab, setRightTab] = useState<RightTab>('tasks')
  const [leftHidden, setLeftHidden] = useState(() => localStorage.getItem('rf_panel_hidden') === '1')

  function toggleLeft() {
    const next = !leftHidden
    setLeftHidden(next)
    localStorage.setItem('rf_panel_hidden', next ? '1' : '0')
  }

  const PANEL_TOP = 132 // nav (60) + filter bar (72)

  return (
    <div>
      <TopNav
        onDocs={() => setSection('important')}
        onMails={() => setSection('emails')}
      />

      {/* Filter bar */}
      <div style={{ position: 'fixed', top: 60, left: 0, right: 0, background: 'rgba(10,11,13,0.95)', borderBottom: '1px solid var(--border)', zIndex: 90, backdropFilter: 'blur(12px)' }}>
        {/* Row 1 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 2rem', overflowX: 'auto', whiteSpace: 'nowrap', scrollbarWidth: 'none' }}>
          {/* Search */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <svg style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value.toLowerCase()); if (section !== 'sites') setSection('sites') }}
              style={{ paddingLeft: '1.8rem', paddingRight: '0.75rem', paddingTop: '0.3rem', paddingBottom: '0.3rem', background: 'rgba(255,255,255,.06)', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text)', fontFamily: 'Inter,sans-serif', fontSize: '0.72rem', width: 120, outline: 'none' }} />
          </div>

          <span style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />

          {(['LRDX', 'RR', 'JDX'] as Brand[]).map(b => (
            <button key={b}
              className={`pill-btn ${section === 'sites' && brand === b ? `active-${b.toLowerCase()}` : ''}`}
              onClick={() => { setBrand(b); setSection('sites') }}>
              {BRAND_LABELS[b]}
            </button>
          ))}

          <span style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />

          {/* Mode toggle */}
          <div className="mode-group">
            <input type="radio" id="m-live" name="dash-mode" checked={mode === 'live'} onChange={() => setMode('live')} />
            <label htmlFor="m-live">Live</label>
            <input type="radio" id="m-cms" name="dash-mode" checked={mode === 'cms'} onChange={() => setMode('cms')} />
            <label htmlFor="m-cms">CMS</label>
          </div>
        </div>

        {/* Row 2 – regions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 2rem', borderTop: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {['all', 'GCC', 'XM', 'LANGS'].map(r => (
            <button key={r} className={`pill-btn ${region === r ? 'active' : ''}`}
              style={{ padding: '0.22rem 0.75rem', fontSize: '0.68rem' }}
              onClick={() => setRegion(r)}>
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: 'flex', alignItems: 'stretch', marginTop: PANEL_TOP, minHeight: `calc(100vh - ${PANEL_TOP}px)` }}>

        {/* Left panel */}
        {!leftHidden && (
          <main style={{ flex: '0 0 40%', minWidth: 260, padding: '1.25rem 1.25rem 1.25rem 1.5rem', borderRight: '1px solid var(--border)', overflowY: 'auto', height: `calc(100vh - ${PANEL_TOP}px)`, position: 'sticky', top: PANEL_TOP }}>
            {section === 'sites' && <BrandPanel brand={brand} mode={mode} region={region} search={search} />}
            {section === 'important' && <ImportantSites />}
            {section === 'emails' && <EmailTemplates />}
          </main>
        )}

        {/* Right panel */}
        <div style={{ flex: 1, minWidth: 0, height: `calc(100vh - ${PANEL_TOP}px)`, background: 'var(--bg)', display: 'flex', flexDirection: 'column', position: 'relative' as 'relative' }}>

          {/* Panel toggle */}
          <button onClick={toggleLeft}
            style={{ position: 'absolute', left: -16, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-2)', border: '1.5px solid rgba(255,255,255,0.18)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,.6)', transition: 'all .2s', padding: 0 }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--accent-dim)'; el.style.borderColor = 'var(--accent)'; el.style.color = 'var(--accent)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--surface-2)'; el.style.borderColor = 'rgba(255,255,255,0.18)'; el.style.color = 'var(--text)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: leftHidden ? 'rotate(180deg)' : 'none', transition: 'transform .3s' }}>
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', flexShrink: 0, padding: '0 1.5rem' }}>
            {([{ id: 'tasks', label: '✓ Content Tasks' }, { id: 'planner', label: '📅 Week Planner' }] as { id: RightTab; label: string }[]).map(tab => (
              <button key={tab.id} onClick={() => setRightTab(tab.id)}
                style={{ padding: '0.6rem 1rem', border: 'none', background: 'none', fontFamily: "'Inter',sans-serif", fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer', color: rightTab === tab.id ? 'var(--accent)' : 'var(--text-3)', borderBottom: `2px solid ${rightTab === tab.id ? 'var(--accent)' : 'transparent'}`, marginBottom: -1, transition: 'all .15s', whiteSpace: 'nowrap' }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, minHeight: 0, padding: '1.25rem 1.5rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {rightTab === 'tasks' && <ContentTasks />}
            {rightTab === 'planner' && <WeekPlanner />}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
