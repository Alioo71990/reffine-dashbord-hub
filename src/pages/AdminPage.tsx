import { useState, useEffect } from 'react'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'
import { useAdmin, addLog, getLog, DEFAULT_MEETINGS } from '../store'
import { AdminLoginGate, getAdminCreds, saveAdminCreds, adminLogout } from '../components/AdminAuth'

type MeetingConfig = import('../store').MeetingConfig

function SectionCard({ title, icon, desc, children }: { title: string; icon: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:16 }}>
      <div style={{ padding:'0.9rem 1.25rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:18 }}>{icon}</span>
        <div>
          <div style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.06em', color:'var(--text)' }}>{title}</div>
          {desc && <div style={{ fontSize:'0.57rem', color:'var(--text-3)', marginTop:1 }}>{desc}</div>}
        </div>
      </div>
      <div style={{ padding:'1.25rem' }}>{children}</div>
    </div>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:'0.54rem', fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:4 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize:'0.57rem', color:'var(--text-3)', marginTop:3 }}>{hint}</div>}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:5,
  color:'var(--text)', fontFamily:'inherit', fontSize:'0.7rem', padding:'0.5rem 0.75rem', outline:'none'
}

function SaveMsg({ msg }: { msg: string }) {
  if (!msg) return null
  return <span style={{ fontSize:'0.62rem', color: msg.startsWith('✓') ? 'var(--accent)' : 'var(--red)' }}>{msg}</span>
}

function FooterBar({ onSave, onReset, msg }: { onSave: ()=>void; onReset: ()=>void; msg: string }) {
  return (
    <div style={{ padding:'0.75rem 1.25rem', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.015)' }}>
      <button onClick={onSave} style={{ background:'var(--accent-dim)', border:'1px solid rgba(0,208,132,.3)', borderRadius:5, color:'var(--accent)', fontSize:'0.68rem', fontWeight:700, padding:'0.42rem 1rem', cursor:'pointer', fontFamily:'inherit' }}>Save</button>
      <button onClick={onReset} style={{ background:'none', border:'1px solid var(--border)', borderRadius:5, color:'var(--text-3)', fontSize:'0.65rem', fontWeight:600, padding:'0.4rem 0.85rem', cursor:'pointer', fontFamily:'inherit' }}>Reset</button>
      <SaveMsg msg={msg} />
    </div>
  )
}

// ─── Meeting Time Editor ──────────────────────────────────────────────────
function MeetingTimeEditor() {
  const { config, saveMeetings } = useAdmin()
  const [form, setForm] = useState<MeetingConfig>({ ...config.meetings })
  const [msg, setMsg] = useState('')
  useEffect(() => { setForm({ ...config.meetings }) }, [config.meetings])
  const show = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const set = (k: keyof MeetingConfig, v: string | number) => setForm(f => ({ ...f, [k]: v }))
  const save = () => { saveMeetings(form); addLog('Updated meeting schedules'); show('✓ Saved — takes effect on next page load') }
  const reset = () => { saveMeetings(DEFAULT_MEETINGS); setForm({ ...DEFAULT_MEETINGS }); show('✓ Reset to defaults') }

  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

  const mtgField = (label: string, sub: string, timeKey: keyof MeetingConfig, dayKey?: keyof MeetingConfig, linkKey?: keyof MeetingConfig, linkKey2?: {key: keyof MeetingConfig; label: string}) => (
    <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'10px 12px', marginBottom:10 }}>
      <div style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text)', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:'0.55rem', color:'var(--text-3)', marginBottom:8 }}>{sub}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
        <Field label="Time (HH:MM, Warsaw)">
          <input type="text" value={String(form[timeKey])} onChange={e => set(timeKey, e.target.value)}
            placeholder="14:00" style={inputStyle} />
        </Field>
        {dayKey && (
          <Field label="Day of week">
            <select value={Number(form[dayKey])} onChange={e => set(dayKey, Number(e.target.value))}
              style={{ ...inputStyle, cursor:'pointer' }}>
              {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </Field>
        )}
      </div>
      {linkKey && <Field label="Meeting Link"><input type="text" value={String(form[linkKey])} onChange={e => set(linkKey, e.target.value)} style={inputStyle} /></Field>}
      {linkKey2 && <Field label={linkKey2.label}><input type="text" value={String(form[linkKey2.key])} onChange={e => set(linkKey2.key, e.target.value)} style={inputStyle} /></Field>}
    </div>
  )

  return (
    <SectionCard title="Meeting Schedule" icon="📅" desc="Customize meeting times and links shown in the navigation bar">
      {mtgField('Weekly Call', 'Recurring weekly team call', 'weeklyTime', 'weeklyDay', 'weeklyLink')}
      {mtgField('Daily Call', 'Morning standup — normal time + Thursday override', 'dailyTime', undefined, 'dailyLink',
        { key: 'dailyTimeThu', label: 'Thursday Time (HH:MM)' })}
      <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'10px 12px', marginBottom:10 }}>
        <div style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text)', marginBottom:8 }}>Daily Call Links</div>
        <Field label="Normal Days Link"><input type="text" value={String(form.dailyLink)} onChange={e => set('dailyLink', e.target.value)} style={inputStyle} /></Field>
        <Field label="Thursday Link"><input type="text" value={String(form.dailyLinkThu)} onChange={e => set('dailyLinkThu', e.target.value)} style={inputStyle} /></Field>
      </div>
      {mtgField('Offers Call', 'Weekly offers review call', 'offersTime', 'offersDay', 'offersLink')}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
        <button onClick={save} style={{ background:'var(--accent-dim)', border:'1px solid rgba(0,208,132,.3)', borderRadius:5, color:'var(--accent)', fontSize:'0.68rem', fontWeight:700, padding:'0.42rem 1rem', cursor:'pointer', fontFamily:'inherit' }}>Save Meeting Config</button>
        <button onClick={reset} style={{ background:'none', border:'1px solid var(--border)', borderRadius:5, color:'var(--text-3)', fontSize:'0.65rem', fontWeight:600, padding:'0.4rem 0.85rem', cursor:'pointer', fontFamily:'inherit' }}>Reset to Defaults</button>
        <SaveMsg msg={msg} />
      </div>
    </SectionCard>
  )
}

function AdminPageInner() {
  const { config, saveConfig, resetConfig } = useAdmin()
  const [sbUrl, setSbUrl]     = useState(config.sbUrl)
  const [sbKey, setSbKey]     = useState(config.sbKey)
  const [groqKey, setGroqKey] = useState(config.groqKey)
  const [csvUrl, setCsvUrl]   = useState(config.tasksCsvUrl)
  const [offersStatusUrl, setOffersStatusUrl] = useState(config.offersStatusUrl)
  const [showSbKey, setShowSbKey]   = useState(false)
  const [showGroq, setShowGroq]     = useState(false)
  const [msg, setMsg] = useState<Record<string, string>>({})
  const [log, setLog] = useState(getLog())
  const [newUser, setNewUser] = useState(getAdminCreds().user)
  const [newPass, setNewPass] = useState('')
  const [newPass2, setNewPass2] = useState('')
  const [showPw, setShowPw] = useState(false)

  const showMsg = (k: string, m: string) => {
    setMsg(prev => ({ ...prev, [k]: m }))
    setTimeout(() => setMsg(prev => ({ ...prev, [k]: '' })), 4000)
  }

  useEffect(() => { setSbUrl(config.sbUrl); setSbKey(config.sbKey); setGroqKey(config.groqKey); setCsvUrl(config.tasksCsvUrl); setOffersStatusUrl(config.offersStatusUrl) }, [config])

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)', display:'flex', flexDirection:'column' }}>
      <TopNav currentPage="admin" />
      <div style={{ marginTop:60, maxWidth:820, margin:'60px auto 0', width:'100%', padding:'1.5rem 1.5rem 4rem' }}>

        <div style={{ marginBottom:20, paddingBottom:14, borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontSize:'1.1rem', fontWeight:700, letterSpacing:'0.04em' }}>Admin Panel</div>
          <div style={{ fontSize:'0.65rem', color:'var(--text-3)', marginTop:2 }}>Configure API keys, data sources, and meeting schedules</div>
        </div>

        {/* Supabase */}
        <SectionCard title="Supabase" icon="🗄️" desc="Week Planner database connection">
          <Field label="Project URL" hint="Found in Supabase → Project Settings → Data API">
            <input type="text" value={sbUrl} onChange={e => setSbUrl(e.target.value)} style={inputStyle} placeholder="https://xxxx.supabase.co" />
          </Field>
          <Field label="Anon Public Key" hint="Settings → Data API → anon public key">
            <div style={{ display:'flex', gap:6 }}>
              <input type={showSbKey?'text':'password'} value={sbKey} onChange={e => setSbKey(e.target.value)} style={{ ...inputStyle, flex:1 }} placeholder="eyJhbGci…" />
              <button onClick={() => setShowSbKey(x=>!x)} style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:4, color:'var(--text-2)', padding:'0 8px', cursor:'pointer', flexShrink:0, fontSize:13 }}>{showSbKey?'🙈':'👁'}</button>
            </div>
          </Field>
          <FooterBar
            onSave={() => { saveConfig({ sbUrl: sbUrl.trim(), sbKey: sbKey.trim() }); addLog('Updated Supabase config'); showMsg('sb','✓ Saved') }}
            onReset={() => { setSbUrl(config.sbUrl); setSbKey(config.sbKey); showMsg('sb','✓ Reset') }}
            msg={msg.sb||''} />
        </SectionCard>

        {/* Groq */}
        <SectionCard title="Groq API" icon="🌐" desc="Powers the Translation Hub. Free tier at console.groq.com">
          <Field label="API Key" hint="Get a free key at console.groq.com → API Keys">
            <div style={{ display:'flex', gap:6 }}>
              <input type={showGroq?'text':'password'} value={groqKey} onChange={e => setGroqKey(e.target.value)} style={{ ...inputStyle, flex:1 }} placeholder="gsk_…" />
              <button onClick={() => setShowGroq(x=>!x)} style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:4, color:'var(--text-2)', padding:'0 8px', cursor:'pointer', flexShrink:0, fontSize:13 }}>{showGroq?'🙈':'👁'}</button>
            </div>
          </Field>
          <FooterBar
            onSave={() => { saveConfig({ groqKey: groqKey.trim() }); addLog('Updated Groq API key'); showMsg('groq','✓ Saved') }}
            onReset={() => { setGroqKey(config.groqKey); showMsg('groq','✓ Reset') }}
            msg={msg.groq||''} />
        </SectionCard>

        {/* Content Tasks CSV */}
        <SectionCard title="Content Tasks — Sheet Tabs" icon="📋" desc="Configure one URL or multiple monthly tabs as a JSON array">
          <div style={{ fontSize:'0.62rem', color:'var(--text-2)', marginBottom:10, lineHeight:1.6, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:5, padding:'8px 10px' }}>
            <strong>Single sheet:</strong> paste one CSV URL directly.<br/>
            <strong>Multiple tabs (months):</strong> paste a JSON array — the tab matching the current month is auto-selected:<br/>
            <code style={{ fontFamily:'monospace', color:'var(--accent)', fontSize:'0.6rem' }}>{`[{"label":"January 2026","url":"...gid=111..."},{"label":"February 2026","url":"...gid=222..."}]`}</code>
          </div>
          <Field label="CSV URL or JSON array of tabs" hint="Each tab URL must end with output=csv">
            <textarea value={csvUrl} onChange={e => setCsvUrl(e.target.value)} rows={4}
              style={{ ...inputStyle, resize:'vertical', fontFamily:'monospace', fontSize:'0.65rem' }}
              placeholder={'Single: https://docs.google.com/...\n\nOr JSON:\n[{"label":"March 2026","url":"...gid=xxx..."},\n {"label":"April 2026","url":"...gid=yyy..."}]'} />
          </Field>
          <FooterBar
            onSave={() => {
              const v = csvUrl.trim()
              // Allow JSON array or single URL
              if (v && !v.startsWith('[') && !v.startsWith('http')) { showMsg('csv','✗ Must be a URL or JSON array'); return }
              saveConfig({ tasksCsvUrl: v }); addLog('Updated Tasks CSV config'); showMsg('csv','✓ Saved')
            }}
            onReset={() => { setCsvUrl(''); saveConfig({ tasksCsvUrl: '' }); showMsg('csv','✓ Reset') }}
            msg={msg.csv||''} />
        </SectionCard>

        {/* Offers Status CSV */}
        <SectionCard title="Offers Status CSV" icon="📊" desc="CSV source for the Offers Status viewer tab">
          <Field label="Google Sheets CSV URL" hint="Published Google Sheet — must end with output=csv">
            <input type="text" value={offersStatusUrl} onChange={e => setOffersStatusUrl(e.target.value)} style={inputStyle}
              placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv" />
          </Field>
          <FooterBar
            onSave={() => {
              const v = offersStatusUrl.trim()
              if (v && !v.startsWith('http')) { showMsg('offers','✗ Must be a valid URL'); return }
              saveConfig({ offersStatusUrl: v }); addLog('Updated Offers Status CSV URL'); showMsg('offers','✓ Saved')
            }}
            onReset={() => { setOffersStatusUrl(''); saveConfig({ offersStatusUrl: '' }); showMsg('offers','✓ Reset') }}
            msg={msg.offers||''} />
        </SectionCard>

        {/* Meeting Schedule */}
        <MeetingTimeEditor />

        {/* Change Log */}
        <SectionCard title="Change Log" icon="📝" desc="Recent admin panel activity">
          <div style={{ display:'flex', flexDirection:'column', gap:2, maxHeight:200, overflowY:'auto' }}>
            {log.length === 0
              ? <div style={{ fontSize:'0.62rem', color:'var(--text-3)', textAlign:'center', padding:'0.75rem' }}>No activity yet</div>
              : log.map((e, i) => (
                  <div key={i} style={{ display:'flex', gap:10, padding:'5px 8px', background:'var(--surface-2)', borderRadius:4, fontSize:'0.62rem' }}>
                    <span style={{ color:'var(--text-3)', flexShrink:0 }}>{e.time}</span>
                    <span style={{ color:'var(--text-2)' }}>{e.msg}</span>
                  </div>
                ))
            }
          </div>
        </SectionCard>

        {/* Admin Credentials */}
        <SectionCard title="Admin Credentials" icon="🔐" desc="Change the username and password to access this admin panel">
          <Field label="Username">
            <input type="text" value={newUser} onChange={e => setNewUser(e.target.value)} style={inputStyle} placeholder="admin" />
          </Field>
          <Field label="New Password">
            <div style={{ display:'flex', gap:6 }}>
              <input type={showPw?'text':'password'} value={newPass} onChange={e => setNewPass(e.target.value)} style={{ ...inputStyle, flex:1 }} placeholder="Enter new password" />
              <button onClick={() => setShowPw(x=>!x)} style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:4, color:'var(--text-2)', padding:'0 8px', cursor:'pointer', flexShrink:0, fontSize:13 }}>{showPw?'🙈':'👁'}</button>
            </div>
          </Field>
          <Field label="Confirm Password">
            <input type="password" value={newPass2} onChange={e => setNewPass2(e.target.value)} style={inputStyle} placeholder="Repeat new password" />
          </Field>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={() => {
              if (!newUser.trim()) { showMsg('creds','✗ Username cannot be empty'); return }
              if (newPass && newPass !== newPass2) { showMsg('creds','✗ Passwords do not match'); return }
              if (newPass && newPass.length < 6) { showMsg('creds','✗ Password must be at least 6 characters'); return }
              const currentCreds = getAdminCreds()
              saveAdminCreds(newUser.trim(), newPass || currentCreds.pass)
              addLog('Updated admin credentials')
              setNewPass(''); setNewPass2('')
              showMsg('creds', '✓ Credentials updated — you will use new credentials next login')
            }} style={{ background:'var(--accent-dim)', border:'1px solid var(--accent-brd)', borderRadius:5, color:'var(--accent)', fontSize:'0.68rem', fontWeight:700, padding:'0.42rem 1rem', cursor:'pointer', fontFamily:'inherit' }}>
              Update Credentials
            </button>
            <button onClick={() => { adminLogout(); window.location.reload() }}
              style={{ background:'var(--red-dim)', border:'1px solid rgba(232,66,74,.3)', borderRadius:5, color:'var(--red)', fontSize:'0.65rem', fontWeight:600, padding:'0.4rem 0.85rem', cursor:'pointer', fontFamily:'inherit' }}>
              Sign Out
            </button>
            <SaveMsg msg={msg.creds||''} />
          </div>
        </SectionCard>
      </div>
      <Footer />
    </div>
  )
}

export function AdminPage() {
  return (
    <AdminLoginGate>
      <AdminPageInner />
    </AdminLoginGate>
  )
}
