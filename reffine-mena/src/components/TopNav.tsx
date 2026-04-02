import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useTheme, useAuth } from '../store'
import { NavClock } from './NavClock'
import { MeetingCountdown } from './MeetingCountdown'

const MEETING_WEEKLY_LINK = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_YzNkOTQ1YmYtYjQxMi00ZDZhLTk5MjAtNjQ0YWU4YzRmNmZm%40thread.v2/0?context=%7b%22Tid%22%3a%224c087f80-1e07-4f72-9e41-d7d9748d0f4c%22%2c%22Oid%22%3a%221c87e926-b217-48d0-8aac-71de272a3f6d%22%7d'
const MEETING_DAILY_LINK = 'https://meet.google.com/pgy-nkum-gic'
const MEETING_OFFERS_LINK = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_NWFjNDgyMGUtOTYyMy00ZjE3LWJmYzItOTk4NjBhNGEyYzkz%40thread.v2/0?context=%7b%22Tid%22%3a%2241eb501a-f671-4ce0-a5bf-b64168c3705f%22%2c%22Oid%22%3a%222ca169c9-6138-482a-8d04-0a07b414d160%22%7d'

const NAV_LINKS = [
  { to: '/translate', label: 'Translate' },
  { to: '/translate-tool', label: 'Translate Tool' },
  { to: '/seo', label: 'SEO' },
  { to: '/offers', label: 'Offers' },
  { to: '/retailers', label: 'Retailers' },
]

export function TopNav({ onDocs, onMails }: { onDocs?: () => void; onMails?: () => void }) {
  const { toggleTheme, theme } = useTheme()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isOnDashboard = location.pathname === '/'
  const [drawerOpen, setDrawerOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 60,
        background: 'rgba(10,11,13,0.96)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 1.5rem', gap: '0.75rem',
        zIndex: 9999, backdropFilter: 'blur(20px)',
        boxSizing: 'border-box', overflow: 'hidden',
        fontFamily: "'Inter', sans-serif"
      }}>
        <NavLink to="/" style={{ display:'flex', flexDirection:'column', gap:1, lineHeight:1.1, textDecoration:'none', flexShrink:0, whiteSpace:'nowrap' }}>
          <span style={{ fontSize:'0.82rem', fontWeight:700, letterSpacing:'0.12em', color:'var(--text)' }}>
            REFFINE <span style={{ color:'var(--accent)' }}>·</span> MENA HUB
          </span>
          <span style={{ fontSize:'0.48rem', fontWeight:500, letterSpacing:'0.18em', color:'var(--text-3)', textTransform:'uppercase' }}>
            Reffine JLR MENA Dashboard
          </span>
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

        {/* Desktop links */}
        <div style={{ display:'flex', alignItems:'center', gap:2, flexShrink:0 }} className="nav-links-desktop">
          {NAV_LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `rf-navlink${isActive ? ' active' : ''}`}>
              {l.label}
            </NavLink>
          ))}
          <div className="nav-divider" />
          {onDocs && <button className="rf-navlink" onClick={onDocs}>Docs</button>}
          {onMails && <button className="rf-navlink" onClick={onMails}>Mails</button>}
        </div>

        {/* Right section — clocks + meetings */}
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginLeft:'auto', flexShrink:0 }} className="rf-right-section">
          <NavClock city="Dubai" timezone="Asia/Dubai" />
          <div className="nav-divider" />
          <NavClock city="Warsaw" timezone="Europe/Warsaw" />
          <div className="nav-divider" />
          <div style={{ display:'flex', gap:'0.4rem', alignItems:'stretch', flexShrink:0 }}>
            <MeetingCountdown label="Weekly Call" sub="Mon 1:00 PM Warsaw" link={MEETING_WEEKLY_LINK} type="weekly" />
            <MeetingCountdown label="Daily Call" sub="07:45 · Thu 07:30 Warsaw" link={MEETING_DAILY_LINK} type="daily" />
            <MeetingCountdown label="Offers Call" sub="Thu 8:00 AM Warsaw" link={MEETING_OFFERS_LINK} type="offers" />
          </div>
        </div>

        {/* User avatar / logout */}
        {user && (
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, marginLeft: '0.5rem' }}>
            {user.avatar
              ? <img src={user.avatar} alt={user.name} style={{ width:26, height:26, borderRadius:'50%', border:'1px solid var(--border-hov)' }} />
              : <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--accent-dim)', border:'1px solid var(--accent-brd)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.6rem', fontWeight:700, color:'var(--accent)' }}>
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
            }
            <button className="btn-ghost" onClick={handleLogout} style={{ fontSize:'0.6rem', padding:'0.22rem 0.55rem' }}>Sign out</button>
          </div>
        )}

        {/* Theme toggle */}
        <button className="theme-btn" onClick={toggleTheme} title="Toggle theme" style={{ marginLeft: 4 }}>
          {theme === 'dark'
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          }
        </button>

        {/* Hamburger */}
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          style={{ display:'none', background:'none', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, padding:'6px 8px', cursor:'pointer', flexShrink:0 }}
          className="hamburger-btn"
          aria-label="Menu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </nav>

      {/* Mobile drawer */}
      <div className={`mobile-drawer${drawerOpen ? ' open' : ''}`}>
        {/* Dashboard link at top of mobile drawer */}
        <NavLink to="/" className={({ isActive }) => `drawer-link${isActive ? ' active' : ''}`}
          onClick={() => setDrawerOpen(false)}
          style={{ fontWeight: 700, color: isOnDashboard ? 'var(--accent)' : 'var(--text)' }}>
          📊 DASHBOARD
        </NavLink>
        {NAV_LINKS.map(l => (
          <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `drawer-link${isActive ? ' active' : ''}`}
            onClick={() => setDrawerOpen(false)}>
            {l.label}
          </NavLink>
        ))}
        {user && <button className="drawer-link" onClick={handleLogout}>Sign out</button>}
      </div>

      <style>{`
        @media (max-width: 1200px) { .rf-right-section { display: none !important; } }
        @media (max-width: 900px) { .nav-links-desktop { display: none !important; } .hamburger-btn { display: flex !important; } }
      `}</style>
    </>
  )
}
