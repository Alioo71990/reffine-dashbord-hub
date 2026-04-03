import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/translate', label: 'Translate' },
  { to: '/seo', label: 'SEO' },
  { to: '/offers', label: 'Offers' },
  { to: '/retailers', label: 'Retailers' },
  { to: '/nav-tools', label: 'Nav+Footer' },
]

export function Footer() {
  return (
    <footer style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', padding: '1.25rem 2rem', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <img
            src="https://www.reffine.com/en/_nuxt/img/reffine-logo.28b93e7.svg"
            alt="Reffine"
            className="reffine-logo"
            style={{ height: 18, width: 'auto', display: 'block' }}
          />
          <span style={{ fontSize: '0.48rem', fontWeight: 500, letterSpacing: '0.18em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
            Reffine JLR MENA Dashboard
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}
              style={({ isActive }) => ({ padding: '0.28rem 0.65rem', borderRadius: 4, fontSize: '0.67rem', fontWeight: 500, letterSpacing: '0.04em', color: isActive ? 'var(--accent)' : 'var(--text-2)', textDecoration: 'none', transition: 'color .15s' })}>
              {l.label}
            </NavLink>
          ))}
          <NavLink to="/admin" style={{ padding:'0.28rem 0.65rem', borderRadius:4, fontSize:'0.67rem', fontWeight:500, color:'var(--accent)', textDecoration:'none' }}>Admin</NavLink>
        </div>
      </div>
    </footer>
  )
}
