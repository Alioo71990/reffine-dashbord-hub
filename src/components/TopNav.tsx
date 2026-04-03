import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTheme, useAdmin } from '../store'
import { NavClock } from './NavClock'
import { MeetingCountdown } from './MeetingCountdown'

const NAV_LINKS = [
  { to: '/translate', label: 'TRANSLATE' },
  { to: '/seo', label: 'SEO' },
  { to: '/offers', label: 'OFFERS' },
  { to: '/retailers', label: 'RETAILERS' },
  { to: '/nav-tools', label: 'NAV+FOOTER' },
]

export function TopNav({ onDocs, onMails, currentPage }: { onDocs?: () => void; onMails?: () => void; currentPage?: string }) {
  const { toggleTheme, theme } = useTheme()
  const { config } = useAdmin()
  const location = useLocation()
  const isOnDashboard = location.pathname === '/'
  const m = config.meetings
  const [drawerOpen, setDrawerOpen] = useState(false)

  const DAILY_LINK = (() => {
    const now = new Date()
    const dayStr = now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw', weekday: 'long' })
    return dayStr === 'Thursday' ? m.dailyLinkThu : m.dailyLink
  })()

  // Parse "HH:MM" → { h, min }
  const parseTime = (s: string) => { const [h,mi] = (s||'07:45').split(':').map(Number); return { h: h||0, min: mi||0 } }
  const wt = parseTime(m.weeklyTime)
  const dt = parseTime(m.dailyTime)
  const dtt = parseTime(m.dailyTimeThu)
  const ot = parseTime(m.offersTime)

  const themeBtn = (
    <button onClick={toggleTheme} aria-label="Toggle theme"
      style={{ display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius:6, flexShrink:0,
        background: theme==='light' ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.06)',
        border: theme==='light' ? '1px solid rgba(0,0,0,.12)' : '1px solid rgba(255,255,255,.1)',
        color: theme==='light' ? '#52596b' : '#8a8e9c', cursor:'pointer', padding:0 }}>
      {theme === 'light'
        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      }
    </button>
  )

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 60,
        background: theme==='light' ? 'rgba(255,255,255,0.96)' : 'rgba(10,11,13,0.96)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 1.5rem', gap: '0.75rem',
        zIndex: 9999, backdropFilter: 'blur(20px)', boxSizing: 'border-box', overflow: 'hidden',
        fontFamily: "'Inter', sans-serif"
      }}>
        <NavLink to="/" style={{ display:'flex', flexDirection:'column', gap:1, lineHeight:1.1, textDecoration:'none', flexShrink:0, whiteSpace:'nowrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <img
              src="https://www.reffine.com/en/_nuxt/img/reffine-logo.28b93e7.svg"
              alt="Reffine"
              className="reffine-logo"
              style={{ height:24, width:'auto', display:'block' }}
            />
            <span style={{ fontSize:'0.48rem', fontWeight:500, letterSpacing:'0.18em', color:'var(--text-3)', textTransform:'uppercase' }}>
              Reffine JLR MENA Dashboard
            </span>
          </div>
        </NavLink>

        <div className="nav-divider" />

        {/* Dashboard button - always visible, prominent position */}
        <NavLink to="/" style={{ display:'flex', alignItems:'center', textDecoration:'none', color:'var(--text)', fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.08em', padding:'6px 12px', borderRadius:6, border:'1px solid var(--border)', flexShrink:0, whiteSpace:'nowrap', transition:'all .15s', background: isOnDashboard ? 'var(--accent-dim)' : 'transparent' }}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--accent-brd)';(e.currentTarget as HTMLElement).style.color='var(--accent)'}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--border)';(e.currentTarget as HTMLElement).style.color='var(--text)'}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          DASHBOARD
        </NavLink>

        <div className="nav-divider" />

        <div style={{ display:'flex', alignItems:'center', gap:2, flexShrink:0 }} className="nav-links-desktop">
          {NAV_LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}
              className={({ isActive }) => `rf-navlink${isActive ? ' active' : ''}`}>
              {l.label}
            </NavLink>
          ))}
          {onDocs  && <button className="rf-navlink" onClick={onDocs}>Docs</button>}
          {onMails && <button className="rf-navlink" onClick={onMails}>Mails</button>}
        </div>

        {/* Right section: clocks + meetings */}
        <div className="nav-right-section" style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginLeft:'auto', flexShrink:0 }}>
          <NavClock city="Dubai" timezone="Asia/Dubai" />
          <div className="nav-divider" />
          <NavClock city="Warsaw" timezone="Europe/Warsaw" />
          <div className="nav-divider" />
          <div style={{ display:'flex', gap:'0.4rem', alignItems:'stretch', flexShrink:0 }}>
            <MeetingCountdown label="Weekly Call" href={m.weeklyLink}
              subLabel={`${DAYS[m.weeklyDay]} ${m.weeklyTime} Warsaw`}
              schedule={{ type:'weekly', day: m.weeklyDay, h: wt.h, min: wt.min }} />
            <MeetingCountdown label="Daily Call" href={DAILY_LINK}
              subLabel={`${m.dailyTime} · Thu ${m.dailyTimeThu} Warsaw`}
              schedule={{ type:'daily', normalH: dt.h, normalMin: dt.min, thuH: dtt.h, thuMin: dtt.min }} />
            <MeetingCountdown label="Offers Call" href={m.offersLink}
              subLabel={`${DAYS[m.offersDay]} ${m.offersTime} Warsaw`}
              schedule={{ type:'weekly', day: m.offersDay, h: ot.h, min: ot.min }} />
          </div>
        </div>

        {themeBtn}

        {/* Hamburger */}
        <button onClick={() => setDrawerOpen(x => !x)} aria-label="Menu"
          style={{ display:'none', background:'none', border:'1px solid rgba(255,255,255,.1)', borderRadius:5, padding:'6px 8px', cursor:'pointer', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0, gap:4, marginLeft:4 }}
          className="nav-hamburger">
          <span style={{ display:'block', width:18, height:1.5, background:'var(--text)', borderRadius:2, transition:'all .25s',
            transform: drawerOpen ? 'translateY(5.5px) rotate(45deg)' : 'none' }} />
          <span style={{ display:'block', width:18, height:1.5, background:'var(--text)', borderRadius:2, transition:'all .25s',
            opacity: drawerOpen ? 0 : 1 }} />
          <span style={{ display:'block', width:18, height:1.5, background:'var(--text)', borderRadius:2, transition:'all .25s',
            transform: drawerOpen ? 'translateY(-5.5px) rotate(-45deg)' : 'none' }} />
        </button>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div style={{
          position:'fixed', top:60, left:0, right:0, zIndex:9998,
          background: theme==='light' ? 'rgba(248,249,252,.99)' : 'rgba(10,11,13,.98)',
          borderBottom:'1px solid var(--border)', padding:'0.75rem 1.5rem 1rem',
          display:'flex', flexDirection:'column', gap:2, backdropFilter:'blur(20px)'
        }} onClick={() => setDrawerOpen(false)}>
          {/* Dashboard link at top of mobile drawer */}
          <NavLink to="/" className={({isActive})=>`rf-navlink${isActive?' active':''}`}
            style={{ padding:'0.65rem 0.75rem', fontSize:'0.78rem', fontWeight:700, color: isOnDashboard ? 'var(--accent)' : 'var(--text)' }}>
            📊 DASHBOARD
          </NavLink>
          <div style={{ height:8 }} />
          {NAV_LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to==='/'} className={({isActive})=>`rf-navlink${isActive?' active':''}`}
              style={{ padding:'0.65rem 0.75rem', fontSize:'0.78rem' }}>
              {l.label}
            </NavLink>
          ))}
          {onDocs  && <button className="rf-navlink" style={{ padding:'0.65rem 0.75rem', fontSize:'0.78rem', textAlign:'left' }} onClick={onDocs}>Docs</button>}
          {onMails && <button className="rf-navlink" style={{ padding:'0.65rem 0.75rem', fontSize:'0.78rem', textAlign:'left' }} onClick={onMails}>Mails</button>}
          <NavLink to="/admin" className="rf-navlink" style={{ padding:'0.65rem 0.75rem', fontSize:'0.78rem', color:'var(--text-3)' }}>ADMIN</NavLink>
        </div>
      )}
    </>
  )
}

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
