import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme, useAuth, useAdmin, addLog } from '../store'
import { ALLOWED_EMAIL_DOMAINS } from '../lib/constants'
import { createClient } from '@supabase/supabase-js'

function isAllowed(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || ''
  return ALLOWED_EMAIL_DOMAINS.includes(domain)
}

export function LoginPage() {
  const { theme, toggleTheme } = useTheme()
  const { setUser, user } = useAuth()
  const { config } = useAdmin()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from?.pathname || '/'

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [oauthMode] = useState(() => !!(config.sbUrl && config.sbKey && config.sbUrl !== 'https://ijofjqnpbxfgvygdjjvh.supabase.co'))

  // If already logged in, redirect
  useEffect(() => { if (user) navigate(from, { replace: true }) }, [user])

  // Handle Supabase OAuth callback
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('access_token') && config.sbUrl && config.sbKey) {
      const sb = createClient(config.sbUrl, config.sbKey)
      sb.auth.getSession().then(({ data }) => {
        const u = data.session?.user
        if (u?.email && isAllowed(u.email)) {
          setUser({ email: u.email, name: u.user_metadata?.full_name, avatar: u.user_metadata?.avatar_url })
          addLog(`Signed in via Google as ${u.email}`)
          navigate('/', { replace: true })
        } else if (u?.email) {
          setError(`Access denied. Your email domain is not authorized.`)
          sb.auth.signOut()
        }
      })
    }
  }, [])

  async function handleGoogleOAuth() {
    if (!config.sbUrl || !config.sbKey) return handleSimulatedLogin()
    setLoading(true)
    try {
      const sb = createClient(config.sbUrl, config.sbKey)
      const { error: err } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/login',
          queryParams: { hd: 'reffine.com' } // hint Google to show work accounts
        }
      })
      if (err) throw err
      // Page will redirect to Google — no need to do more
    } catch (e: any) {
      setLoading(false)
      setError(e.message || 'Sign in failed')
      doShake()
    }
  }

  async function handleSimulatedLogin() {
    setError('')
    if (!email.trim()) { setError('Please enter your email address'); doShake(); return }
    if (!email.includes('@')) { setError('Please enter a valid email'); doShake(); return }
    if (!isAllowed(email.trim().toLowerCase())) {
      setError('Access restricted to @reffine.com and @jaguarlandrover.com accounts')
      doShake(); return
    }
    setLoading(true)
    await new Promise(r => setTimeout(r, 600))
    const name = email.split('@')[0].split('.').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
    setUser({ email: email.trim().toLowerCase(), name })
    addLog(`Signed in as ${email}`)
    navigate(from, { replace: true })
  }

  function doShake() { setShake(true); setTimeout(() => setShake(false), 500) }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at 50% 40%, rgba(0,208,132,0.06) 0%, transparent 65%)' }}>

      <button className="theme-btn" onClick={toggleTheme}
        style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 100 }} title="Toggle theme">
        {theme === 'dark'
          ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg>
        }
      </button>

      <div style={{ width: '100%', maxWidth: 400, padding: '1.5rem' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-dim)', border: '1px solid var(--accent-brd)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text)' }}>
            REFFINE <span style={{ color: 'var(--accent)' }}>·</span> MENA
          </div>
          <div style={{ fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--text-3)', marginTop: 5 }}>
            JLR Hub — Internal Dashboard
          </div>
        </div>

        <div className="card" style={{ padding: '2rem 2rem 1.75rem', boxShadow: '0 24px 60px rgba(0,0,0,0.55)', animation: shake ? 'shake 0.4s ease' : 'none' }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', textAlign: 'center', marginBottom: '1.75rem' }}>
            Sign in to continue
          </div>

          {/* Google OAuth button (primary) */}
          <button className="google-btn" onClick={oauthMode ? handleGoogleOAuth : undefined}
            disabled={loading}
            style={{ marginBottom: '1.25rem', position: 'relative', ...(loading ? { opacity: 0.7 } : {}) }}>
            {loading
              ? <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9"/></svg>
              : <svg viewBox="0 0 48 48" width="18" height="18">
                  <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
                  <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z"/>
                  <path fill="#FBBC05" d="M24 46c5.9 0 10.9-2 14.6-5.4l-6.7-5.5C29.9 37 27.1 38 24 38c-6 0-10.7-3.9-12-9.1l-7 5.4C8 41.4 15.4 46 24 46z"/>
                  <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.9 2.9-3 5.4-5.8 7l6.7 5.5C41.3 37 44.5 31 44.5 24c0-1.3-.2-2.7-.5-4z"/>
                </svg>
            }
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          {/* Divider + email fallback (when no Supabase configured) */}
          {!oauthMode && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.25rem' }}>
                <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: '0.58rem', color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>or enter email to preview</span>
                <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <div style={{ marginBottom: error ? '0.75rem' : '1rem' }}>
                <label style={{ fontSize: '0.54rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Work Email</label>
                <input className="field-input" type="email" placeholder="you@reffine.com" value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleSimulatedLogin()} autoFocus />
              </div>

              {error && (
                <div style={{ fontSize: '0.65rem', color: 'var(--red)', background: 'var(--red-dim)', border: '1px solid rgba(232,66,74,.22)', borderRadius: 5, padding: '0.5rem 0.75rem', textAlign: 'center', marginBottom: '0.75rem' }}>
                  {error}
                </div>
              )}

              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSimulatedLogin} disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In →'}
              </button>
            </>
          )}

          {oauthMode && error && (
            <div style={{ fontSize: '0.65rem', color: 'var(--red)', background: 'var(--red-dim)', border: '1px solid rgba(232,66,74,.22)', borderRadius: 5, padding: '0.5rem 0.75rem', textAlign: 'center', marginTop: '0.75rem' }}>
              {error}
            </div>
          )}

          <p style={{ fontSize: '0.58rem', color: 'var(--text-3)', textAlign: 'center', marginTop: '1rem', lineHeight: 1.6 }}>
            Restricted to <strong style={{ color: 'var(--text-2)' }}>@reffine.com</strong> and <strong style={{ color: 'var(--text-2)' }}>@jaguarlandrover.com</strong>
          </p>
        </div>

        {!oauthMode && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(232,151,58,.06)', border: '1px solid rgba(232,151,58,.2)', borderRadius: 6 }}>
            <p style={{ fontSize: '0.6rem', color: 'var(--orange)', lineHeight: 1.6, textAlign: 'center' }}>
              <strong>Dev mode</strong> — Google OAuth not configured.<br />
              Add your Supabase URL &amp; key in <strong>/admin</strong> to enable real Google sign-in.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{ transform: translateX(0); }
          20%{ transform: translateX(-8px); }
          40%{ transform: translateX(8px); }
          60%{ transform: translateX(-5px); }
          80%{ transform: translateX(5px); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { animation: spin .7s linear infinite; }
      `}</style>
    </div>
  )
}
