import { useState, useEffect } from 'react'

const SESSION_KEY = 'rf_admin_session'
const CREDS_KEY = 'rf_admin_creds'
const DEFAULT_USER = 'admin'
const DEFAULT_PASS = 'reffine2026'
const SESSION_TOKEN = 'rf_auth_ok_v1'

export function getAdminCreds() {
  try { const c = JSON.parse(localStorage.getItem(CREDS_KEY) || '{}'); return { user: c.user || DEFAULT_USER, pass: c.pass || DEFAULT_PASS } }
  catch { return { user: DEFAULT_USER, pass: DEFAULT_PASS } }
}
export function saveAdminCreds(user: string, pass: string) {
  localStorage.setItem(CREDS_KEY, JSON.stringify({ user: user.trim(), pass }))
}
export function isAdminLoggedIn() { return localStorage.getItem(SESSION_KEY) === SESSION_TOKEN }
export function adminLogin(user: string, pass: string) {
  const creds = getAdminCreds()
  if (user.trim() === creds.user && pass === creds.pass) {
    localStorage.setItem(SESSION_KEY, SESSION_TOKEN); return true
  }
  return false
}
export function adminLogout() { localStorage.removeItem(SESSION_KEY) }

export function AdminLoginGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(isAdminLoggedIn)
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [show, setShow] = useState(false)

  if (authed) return <>{children}</>

  const submit = () => {
    if (adminLogin(user, pass)) { setAuthed(true); setErr('') }
    else setErr('Invalid username or password')
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
      <div style={{ marginBottom:32, textAlign:'center' }}>
        <div style={{ width:52, height:52, borderRadius:12, background:'var(--accent-grad)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:'0 4px 20px rgba(233,30,140,0.3)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div style={{ fontSize:'1.1rem', fontWeight:800, letterSpacing:'0.12em', color:'var(--text)' }}>REFFINE <span style={{ background:'var(--accent-grad)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>·</span> ADMIN</div>
        <div style={{ fontSize:'0.6rem', letterSpacing:'0.14em', color:'var(--text-3)', marginTop:4, textTransform:'uppercase' }}>Internal Dashboard</div>
      </div>

      <div style={{ width:'100%', maxWidth:340, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'1.75rem' }}>
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:'0.56rem', fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:5 }}>Username</div>
          <input type="text" value={user} onChange={e => setUser(e.target.value)} onKeyDown={e => e.key==='Enter' && submit()}
            autoFocus placeholder="admin"
            style={{ width:'100%', background:'var(--surface-2)', border:`1px solid ${err?'var(--red)':'var(--border)'}`, borderRadius:6, color:'var(--text)', fontFamily:'inherit', fontSize:'0.78rem', padding:'0.6rem 0.8rem', outline:'none' }} />
        </div>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:'0.56rem', fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:5 }}>Password</div>
          <div style={{ position:'relative' }}>
            <input type={show?'text':'password'} value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key==='Enter' && submit()}
              placeholder="••••••••"
              style={{ width:'100%', background:'var(--surface-2)', border:`1px solid ${err?'var(--red)':'var(--border)'}`, borderRadius:6, color:'var(--text)', fontFamily:'inherit', fontSize:'0.78rem', padding:'0.6rem 2.2rem 0.6rem 0.8rem', outline:'none' }} />
            <button onClick={() => setShow(x=>!x)} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:13, padding:2 }}>
              {show ? '🙈' : '👁'}
            </button>
          </div>
        </div>
        {err && <div style={{ fontSize:'0.65rem', color:'var(--red)', marginBottom:12, textAlign:'center' }}>{err}</div>}
        <button onClick={submit}
          style={{ width:'100%', background:'var(--accent-grad)', border:'none', borderRadius:6, color:'#fff', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700, padding:'0.65rem', cursor:'pointer', boxShadow:'0 2px 10px rgba(233,30,140,0.3)', letterSpacing:'0.04em' }}>
          Sign In →
        </button>
      </div>
    </div>
  )
}
