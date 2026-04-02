import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin, useAuth, addLog, getLog } from '../store'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'

function Section({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(0,208,132,0.1)', border: '1px solid rgba(0,208,132,0.2)' }}>{icon}</div>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text)' }}>{title}</div>
          <div style={{ fontSize: '0.57rem', color: 'var(--text-3)' }}>{desc}</div>
        </div>
      </div>
      {children}
    </div>
  )
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: '0.54rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        {label}
        {required !== undefined && <span style={{ fontSize: '0.5rem', padding: '1px 6px', borderRadius: 10, fontWeight: 700, background: required ? 'var(--red-dim)' : 'rgba(138,142,156,.08)', color: required ? 'var(--red)' : 'var(--text-3)', border: `1px solid ${required ? 'rgba(232,66,74,.2)' : 'rgba(138,142,156,.15)'}` }}>{required ? 'Required' : 'Optional'}</span>}
      </div>
      {children}
      {hint && <div style={{ fontSize: '0.57rem', color: 'var(--text-3)', lineHeight: 1.5, marginTop: 4 }} dangerouslySetInnerHTML={{ __html: hint }} />}
    </div>
  )
}

export function AdminPage() {
  const { config, saveConfig, resetConfig } = useAdmin()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [sbUrl, setSbUrl] = useState(config.sbUrl)
  const [sbKey, setSbKey] = useState(config.sbKey)
  const [groqKey, setGroqKey] = useState(config.groqKey)
  const [tasksCsv, setTasksCsv] = useState(config.tasksCsvUrl)
  const [showSbKey, setShowSbKey] = useState(false)
  const [showGroqKey, setShowGroqKey] = useState(false)
  const [msgs, setMsgs] = useState<Record<string, { text: string; ok: boolean }>>({})
  const [log, setLog] = useState(getLog())

  function showMsg(key: string, text: string, ok: boolean) {
    setMsgs(prev => ({ ...prev, [key]: { text, ok } }))
    setTimeout(() => setMsgs(prev => { const n = { ...prev }; delete n[key]; return n }), 4000)
    setLog(getLog())
  }

  function saveSupabase() {
    if (!sbUrl || !sbKey) { showMsg('sb', 'Both fields required', false); return }
    if (!sbUrl.startsWith('https://')) { showMsg('sb', 'URL must start with https://', false); return }
    saveConfig({ sbUrl: sbUrl.replace(/\/rest\/v1.*$/, '').replace(/\/$/, ''), sbKey })
    addLog('Updated Supabase config')
    showMsg('sb', '✓ Saved — takes effect on next page load', true)
  }

  function saveGroq() {
    if (!groqKey) { showMsg('groq', 'API key required', false); return }
    if (!groqKey.startsWith('gsk_')) { showMsg('groq', 'Groq keys start with gsk_', false); return }
    saveConfig({ groqKey })
    addLog('Updated Groq API key')
    showMsg('groq', '✓ Saved', true)
  }

  function saveTasksCsv() {
    if (tasksCsv && !tasksCsv.includes('output=csv')) { showMsg('csv', 'URL must end with output=csv', false); return }
    try { localStorage.setItem('rf_tasks_csv_url', tasksCsv) } catch {}
    saveConfig({ tasksCsvUrl: tasksCsv })
    addLog('Updated Content Tasks CSV URL')
    showMsg('csv', tasksCsv ? '✓ Saved' : '✓ Cleared — using default', true)
  }

  const Msg = ({ k }: { k: string }) => msgs[k] ? <span style={{ fontSize: '0.62rem', color: msgs[k].ok ? 'var(--accent)' : 'var(--red)', marginLeft: 'auto' }}>{msgs[k].text}</span> : null

  const iS: React.CSSProperties = { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', fontFamily: "'IBM Plex Mono','Inter',sans-serif", fontSize: '0.7rem', padding: '0.5rem 0.75rem', outline: 'none', transition: 'border-color .15s' }
  const footer = (saveLabel: string, saveAction: () => void, resetAction?: () => void, msgKey?: string) => (
    <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,.015)' }}>
      <button className="btn-primary" style={{ fontSize: '0.68rem', padding: '0.42rem 1.1rem' }} onClick={saveAction}>{saveLabel}</button>
      {resetAction && <button className="btn-ghost" style={{ fontSize: '0.65rem' }} onClick={resetAction}>Reset to Default</button>}
      {msgKey && <Msg k={msgKey} />}
    </div>
  )

  return (
    <div style={{ paddingTop: 60 }}>
      <TopNav />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {/* Status bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.65rem', padding: '0.6rem 1rem', borderRadius: 5, border: '1px solid rgba(0,208,132,.25)', background: 'rgba(0,208,132,.08)', color: 'var(--accent)', marginBottom: 18 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          All configurations loaded. Changes take effect immediately on next page load.
          {user && <span style={{ marginLeft: 'auto', color: 'var(--text-3)' }}>Signed in as {user.email}</span>}
        </div>

        {/* Supabase */}
        <Section icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="2"><path d="M4 7v10c0 2.2 3.6 4 8 4s8-1.8 8-4V7"/><ellipse cx="12" cy="7" rx="8" ry="4"/></svg>} title="Supabase — Week Planner Database" desc="Used by the Week Planner to store and sync tasks and team members">
          <div style={{ padding: '1.25rem' }}>
            <Field label="Project URL" required={true} hint="Found in Supabase → Project Settings → API Keys → Project URL">
              <input style={iS} type="text" value={sbUrl} onChange={e => setSbUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
            </Field>
            <Field label="Anon Public Key" required={true} hint="Supabase → Settings → API Keys → Legacy → <strong>anon public</strong> key">
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...iS, flex: 1, letterSpacing: '0.08em' }} type={showSbKey ? 'text' : 'password'} value={sbKey} onChange={e => setSbKey(e.target.value)} placeholder="eyJhbGci…" />
                <button className="btn-ghost" onClick={() => setShowSbKey(!showSbKey)} style={{ flexShrink: 0 }}>{showSbKey ? '🙈' : '👁'}</button>
              </div>
            </Field>
          </div>
          {footer('Save Supabase Config', saveSupabase, () => { setSbUrl(config.sbUrl); setSbKey(config.sbKey); resetConfig(); addLog('Reset Supabase config'); showMsg('sb', '✓ Reset to defaults', true) }, 'sb')}
        </Section>

        {/* Groq */}
        <Section icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5b8dee" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10"/></svg>} title="Groq API — Translation Hub" desc="Powers AI translation. Free tier: 14,400 requests/day at console.groq.com">
          <div style={{ padding: '1.25rem' }}>
            <Field label="Groq API Key" required={true} hint='Get a free key at <a href="https://console.groq.com" target="_blank" style="color:var(--accent)">console.groq.com</a> → API Keys → Create API Key'>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...iS, flex: 1, letterSpacing: '0.08em' }} type={showGroqKey ? 'text' : 'password'} value={groqKey} onChange={e => setGroqKey(e.target.value)} placeholder="gsk_…" />
                <button className="btn-ghost" onClick={() => setShowGroqKey(!showGroqKey)} style={{ flexShrink: 0 }}>{showGroqKey ? '🙈' : '👁'}</button>
              </div>
            </Field>
          </div>
          {footer('Save Groq Config', saveGroq, () => { setGroqKey(config.groqKey); addLog('Reset Groq key'); showMsg('groq', '✓ Reset', true) }, 'groq')}
        </Section>

        {/* Tasks CSV */}
        <Section icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d084" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>} title="Content Tasks — CSV Source" desc="Set the Google Sheets CSV URL shown in the Content Tasks panel">
          <div style={{ padding: '1.25rem' }}>
            <Field label="CSV URL" required={true} hint="Google Sheets: File → Share → Publish to web → choose sheet → CSV → copy URL">
              <input style={iS} type="text" value={tasksCsv} onChange={e => setTasksCsv(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?…&output=csv" />
            </Field>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-2)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 10px', wordBreak: 'break-all', lineHeight: 1.6, fontFamily: 'monospace' }}>
              {tasksCsv || '— Using default URL —'}
            </div>
          </div>
          {footer('Save CSV URL', saveTasksCsv, () => { setTasksCsv(''); try { localStorage.removeItem('rf_tasks_csv_url') } catch {}; addLog('Reset CSV URL'); showMsg('csv', '✓ Reset to default', true) }, 'csv')}
        </Section>

        {/* Change Log */}
        <Section icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a8e9c" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>} title="Change Log" desc="Recent admin panel activity on this browser">
          <div style={{ padding: '0.75rem 1.25rem' }}>
            {!log.length ? (
              <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', padding: '0.75rem', textAlign: 'center' }}>No activity yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 180, overflowY: 'auto' }}>
                {log.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: 4, background: 'var(--surface-2)', fontSize: '0.62rem' }}>
                    <span style={{ color: 'var(--text-3)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{e.time}</span>
                    <span style={{ color: 'var(--text-2)' }}>{e.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>
      </div>
      <Footer />
    </div>
  )
}
