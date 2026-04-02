import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/translate', label: 'Translate' },
  { to: '/translate-tool', label: 'Translate Tool' },
  { to: '/seo', label: 'SEO' },
  { to: '/offers', label: 'Offers' },
  { to: '/retailers', label: 'Retailers' },
]

export function Footer() {
  return (
    <footer style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', padding: '1.25rem 2rem', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(138,142,156,0.32)' }}>
          Reffine · MENA · JLR Hub
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}
              style={({ isActive }) => ({ padding: '0.28rem 0.65rem', borderRadius: 4, fontSize: '0.67rem', fontWeight: 500, letterSpacing: '0.04em', color: isActive ? 'var(--accent)' : 'var(--text-2)', textDecoration: 'none', transition: 'color .15s' })}>
              {l.label}
            </NavLink>
          ))}
          <NavLink to="/admin" style={{ padding:'0.28rem 0.65rem', borderRadius:4, fontSize:'0.67rem', fontWeight:500, color:'rgba(138,142,156,0.35)', textDecoration:'none' }}>Admin</NavLink>
        </div>
      </div>
    </footer>
  )
}
