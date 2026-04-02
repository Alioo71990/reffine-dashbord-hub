import { useState, useRef, useCallback, useEffect } from 'react'
import { TopNav } from '../components/TopNav'
import { useTheme } from '../store'
import Papa from 'papaparse'

// ─── Types ───────────────────────────────────────────────────────────────────
type ReportType = '404' | 'broken' | 'chain' | 'hreflang' | 'unknown'
type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
type FixType = 'restore' | 'redirect' | 'update-links' | 'collapse-chain' | 'fix-hreflang' | 'review'

interface RowIssue {
  id: string
  raw: Record<string, string>
  url: string
  finalUrl: string
  source: string
  statusCode: string
  inlinks: number
  hops: number
  hreflangIssues: string
  priority: Priority
  fixType: FixType
  confidence: number // 0-100
  summary: string
  whyMatters: string
  action: string
  devInstruction: string
  fixed: boolean
  assignee: string
  notes: string
}

interface SeoFile {
  id: string
  name: string
  type: ReportType
  rows: RowIssue[]
  uploadedAt: number
  headers: string[]
}

// ─── Column normalization ─────────────────────────────────────────────────────
function norm(raw: Record<string, string>) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const found = Object.entries(raw).find(([col]) => col.toLowerCase().includes(k.toLowerCase()))
      if (found && found[1]) return found[1].trim()
    }
    return ''
  }
  return {
    url:          get('url','address','page url','source url'),
    finalUrl:     get('final url','redirect url','destination','target'),
    source:       get('first found','referrer','source','referring page'),
    status:       get('http status','status code','response code','code'),
    inlinks:      parseInt(get('no. of all inlinks','inlinks','internal links','no. of inlinks') || '0') || 0,
    backlinks:    parseInt(get('backlinks','referring domains','ref.domains') || '0') || 0,
    hops:         parseInt(get('no. of redirect chain','chain length','hops') || '0') || 0,
    chainUrls:    get('chain urls','redirect chain urls'),
    hreflangIssues: get('hreflang issues','issue','issues'),
    hreflangLink: get('hreflang link','hreflang url','alternate'),
    traffic:      parseInt(get('traffic','organic traffic') || '0') || 0,
    ur:           parseInt(get('url rating','ur','pr') || '0') || 0,
  }
}

// ─── Report Detection ─────────────────────────────────────────────────────────
function detectType(filename: string, headers: string[], rows: Record<string, string>[]): ReportType {
  const fn = filename.toLowerCase()
  const h = headers.map(x => x.toLowerCase()).join(' ')
  const sample = rows.slice(0, 20)

  if (fn.includes('hreflang') || h.includes('hreflang')) return 'hreflang'
  if (fn.includes('redirect-chain') || fn.includes('redirect_chain') || h.includes('chain url')) return 'chain'
  if (fn.includes('broken-redirect') || fn.includes('broken_redirect')) return 'broken'
  if (fn.includes('404') || fn.includes('broken')) return '404'

  if (h.includes('hreflang')) return 'hreflang'
  if (h.includes('chain')) return 'chain'

  const hasFinalUrl = h.includes('redirect url') || h.includes('final url') || h.includes('destination')
  const has404Dest = sample.some(r => {
    const n = norm(r)
    return (n.finalUrl && (r[Object.keys(r).find(k=>k.toLowerCase().includes('redirect url code'))||'']||'').includes('404'))
  })
  if (hasFinalUrl && has404Dest) return 'broken'

  if (sample.some(r => (norm(r).status||'').includes('404'))) return '404'
  return 'unknown'
}

// ─── Priority Engine ─────────────────────────────────────────────────────────
function calcPriority(type: ReportType, n: ReturnType<typeof norm>): Priority {
  const { inlinks, backlinks, hops, hreflangIssues, traffic, ur } = n
  const importance = inlinks * 2 + backlinks + traffic / 10 + ur

  if (type === '404') {
    if (importance >= 300 || inlinks >= 100) return 'CRITICAL'
    if (importance >= 80 || inlinks >= 20) return 'HIGH'
    if (importance >= 20 || inlinks >= 5) return 'MEDIUM'
    return 'LOW'
  }
  if (type === 'broken') {
    if (importance >= 200 || inlinks >= 50) return 'CRITICAL'
    if (importance >= 50 || inlinks >= 10) return 'HIGH'
    return 'MEDIUM'
  }
  if (type === 'chain') {
    if (hops >= 5) return 'CRITICAL'
    if (hops >= 3) return 'HIGH'
    if (hops >= 2) return 'MEDIUM'
    return 'LOW'
  }
  if (type === 'hreflang') {
    const issues = hreflangIssues.toLowerCase()
    if (issues.includes('404') && inlinks >= 10) return 'CRITICAL'
    if (issues.includes('404') || issues.includes('missing self')) return 'HIGH'
    if (issues.includes('301') || issues.includes('missing')) return 'MEDIUM'
    return 'LOW'
  }
  return 'LOW'
}

// ─── Interpretation Engine ────────────────────────────────────────────────────
function interpret(type: ReportType, n: ReturnType<typeof norm>, priority: Priority): {
  summary: string; whyMatters: string; action: string; devInstruction: string; fixType: FixType; confidence: number
} {
  const short = (s: string, l = 70) => s.length > l ? s.slice(0, l) + '…' : s
  const url = n.url ? short(n.url) : 'this URL'
  const dest = n.finalUrl ? short(n.finalUrl) : 'the destination'

  if (type === '404') {
    const il = n.inlinks
    if (il === 0) return {
      summary: `Dead page with no internal links — low impact but should be cleaned up.`,
      whyMatters: 'No link equity is lost, but it may confuse crawlers if referenced anywhere.',
      action: 'Remove any remaining references. No redirect needed unless the page had backlinks.',
      devInstruction: `Check if ${url} has backlinks. If yes, add a 301 redirect to the closest live page. If no, remove all internal links to this URL.`,
      fixType: 'review', confidence: 70
    }
    if (il >= 50) return {
      summary: `High-traffic dead page — ${il} pages still link here. Immediate action required.`,
      whyMatters: `${il} internal links send users and crawlers to a broken page. This damages UX, wastes crawl budget, and loses link equity.`,
      action: `Add a 301 redirect from ${url} to the best matching live page. Then update the ${il} internal links to point directly to the new URL.`,
      devInstruction: `1. Set up 301 redirect: ${url} → [best-matching-live-URL]\n2. Verify the destination returns 200.\n3. Update all ${il} internal links to use the final destination URL directly.`,
      fixType: 'redirect', confidence: 92
    }
    return {
      summary: `Broken page with ${il} internal link${il!==1?'s':''} still pointing to it.`,
      whyMatters: `Internal links pointing to a 404 waste crawl budget and provide a poor user experience.`,
      action: `Add a 301 redirect to the nearest relevant live page. Update internal links to avoid the extra hop.`,
      devInstruction: `1. Set up 301 redirect: ${url} → [best-matching-live-URL]\n2. Update internal links on ${n.source || 'linking pages'} to use the final URL directly.\n3. Confirm final destination returns 200.`,
      fixType: 'redirect', confidence: 85
    }
  }

  if (type === 'broken') {
    return {
      summary: `Redirect points to broken destination (${n.status || '404'}). Users hit a dead end.`,
      whyMatters: `A redirect that ends at a 404 is worse than no redirect — it actively wastes link equity and confuses crawlers.`,
      action: `Update the redirect rule for ${url} so it points to a live (200) page instead of ${dest}.`,
      devInstruction: `Update redirect rule:\n  FROM: ${url}\n  CURRENTLY GOES TO: ${dest} (${n.status || '404'})\n  FIX: Point to [live-200-url]\nThen update any internal links still pointing to ${url}.`,
      fixType: 'update-links', confidence: 90
    }
  }

  if (type === 'chain') {
    const h = n.hops || 2
    const chains = n.chainUrls.split(',').map(s => s.trim()).filter(Boolean)
    const finalDest = chains.length ? chains[chains.length - 1] : dest
    return {
      summary: `${h}-hop redirect chain — ${h} unnecessary steps before reaching the final page.`,
      whyMatters: `Each extra redirect wastes PageRank, slows page load, and may cause crawlers to give up before reaching the destination. Google recommends max 3 hops total.`,
      action: `Collapse the chain: update the first URL (${url}) to redirect directly to the final destination in one hop.`,
      devInstruction: `Collapse redirect chain:\n  FROM: ${url}\n  SKIP ALL MIDDLE HOPS\n  REDIRECT DIRECTLY TO: ${finalDest || '[final-200-url]'}\nVerify the final destination returns 200. Update any internal links to use the final URL directly.`,
      fixType: 'collapse-chain', confidence: 95
    }
  }

  if (type === 'hreflang') {
    const issues = n.hreflangIssues
    const isMissingSelf = issues.toLowerCase().includes('missing self')
    const has404 = issues.toLowerCase().includes('404')
    const has301 = issues.toLowerCase().includes('301')
    if (has404) return {
      summary: `Hreflang tag points to a 404 page — search engines will ignore this alternate.`,
      whyMatters: `If a hreflang target is broken, Google ignores the entire hreflang cluster for that language. You lose regional targeting.`,
      action: `Replace the broken hreflang target URL with a live 200 URL. Check all language alternates for this page.`,
      devInstruction: `1. Find the hreflang tag for ${url} pointing to ${n.hreflangLink || '[broken-url]'}\n2. Replace the broken target with a live 200 URL\n3. Verify all other hreflang alternates for this page also return 200\n4. Ensure there is a self-referencing hreflang tag on the page`,
      fixType: 'fix-hreflang', confidence: 93
    }
    if (has301) return {
      summary: `Hreflang target redirects (301) — replace with the final URL.`,
      whyMatters: `Hreflang tags must point to the exact canonical URL. Redirected targets may be ignored by Google.`,
      action: `Update the hreflang tag to use the final destination URL, not the redirecting one.`,
      devInstruction: `Update hreflang tag on ${url}:\n  CURRENT TARGET: ${n.hreflangLink || '[redirecting-url]'} (returns 301)\n  FIX: Use the final 200 URL in the hreflang tag directly`,
      fixType: 'fix-hreflang', confidence: 88
    }
    if (isMissingSelf) return {
      summary: `Page is missing a self-referencing hreflang tag.`,
      whyMatters: `Without a self-referencing tag, the hreflang cluster is incomplete. Google may ignore the entire set of alternates.`,
      action: `Add a hreflang tag on this page that points back to itself, plus ensure all alternates are listed correctly.`,
      devInstruction: `Add to <head> of ${url}:\n<link rel="alternate" hreflang="[this-page-lang]" href="${url}" />\nAlso verify all other language alternates point to live 200 URLs.`,
      fixType: 'fix-hreflang', confidence: 90
    }
    return {
      summary: `Hreflang issue: ${issues.slice(0, 100)}`,
      whyMatters: `Incomplete or broken hreflang signals cause incorrect language/country targeting in search results.`,
      action: `Audit all hreflang tags on this page. Ensure targets are 200, self-referencing tag exists, and x-default is set.`,
      devInstruction: `Audit hreflang tags on ${url}. Check all alternate URLs return 200. Add missing self-referencing tag. Consider adding x-default if not present.`,
      fixType: 'fix-hreflang', confidence: 75
    }
  }

  return {
    summary: 'Review this row manually — report type not fully recognized.',
    whyMatters: 'Unknown issue type — inspect the raw data below.',
    action: 'Open the raw data and investigate this URL directly.',
    devInstruction: `Manually review: ${url}`,
    fixType: 'review', confidence: 40
  }
}

// ─── Row Builder ─────────────────────────────────────────────────────────────
let _rid = 0
function buildRow(type: ReportType, raw: Record<string, string>, storedMeta?: {fixed?:boolean;assignee?:string;notes?:string}): RowIssue {
  const n = norm(raw)
  const prio = calcPriority(type, n)
  const { summary, whyMatters, action, devInstruction, fixType, confidence } = interpret(type, n, prio)
  return {
    id: `r_${++_rid}`,
    raw, url: n.url, finalUrl: n.finalUrl, source: n.source,
    statusCode: n.status, inlinks: n.inlinks, hops: n.hops,
    hreflangIssues: n.hreflangIssues,
    priority: prio, fixType, confidence,
    summary, whyMatters, action, devInstruction,
    fixed: storedMeta?.fixed || false,
    assignee: storedMeta?.assignee || '',
    notes: storedMeta?.notes || '',
  }
}

// ─── Persistence ─────────────────────────────────────────────────────────────
const STORE_KEY = 'rf_seo_meta'
type MetaMap = Record<string, {fixed:boolean;assignee:string;notes:string}>
function loadMeta(): MetaMap { try { return JSON.parse(localStorage.getItem(STORE_KEY)||'{}') } catch { return {} } }
function saveMeta(m: MetaMap) { try { localStorage.setItem(STORE_KEY, JSON.stringify(m)) } catch {} }

// ─── Sample CSV ───────────────────────────────────────────────────────────────
const SAMPLE_404 = `URL,HTTP status code,No. of all inlinks,First found at,Backlinks
https://example.com/old-product,404,145,https://example.com/shop,12
https://example.com/blog/2022/post-one,404,3,https://example.com/blog,0
https://example.com/services/legacy,404,67,https://example.com/home,5
https://example.com/contact-old,404,0,,0
https://example.com/about-us-old,404,22,https://example.com/nav,2`

const SAMPLE_BROKEN = `URL,Redirect URL,Redirect URL code,No. of all inlinks,First found at
https://example.com/redir-a,https://example.com/gone,404,89,https://example.com/
https://example.com/redir-b,https://example.com/missing,404,12,https://example.com/blog
https://example.com/redir-c,https://example.com/also-gone,404,3,https://example.com/footer`

const SAMPLE_CHAIN = `URL,Final URL,No. of redirect chain URLs,No. of all inlinks
https://example.com/start,https://example.com/final,5,44
https://example.com/old-path,https://example.com/new,3,8
https://example.com/legacy,https://example.com/current,2,120`

const SAMPLE_HREFLANG = `URL,Hreflang link,Hreflang issues,No. of all inlinks
https://example.com/en/page,https://example.com/ar/page,Hreflang link returns 404,30
https://example.com/ar/page,https://example.com/en/page,Missing self-referencing hreflang,12
https://example.com/fr/page,https://example.com/ar/page,Hreflang link returns 301,5`

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIORITY_META: Record<Priority, {color:string;bg:string;label:string;icon:string}> = {
  CRITICAL: {color:'#dc2626',bg:'rgba(220,38,38,.12)',label:'Critical',icon:'🔴'},
  HIGH:     {color:'#ea580c',bg:'rgba(234,88,12,.12)', label:'High',    icon:'🟠'},
  MEDIUM:   {color:'#ca8a04',bg:'rgba(202,138,4,.12)',  label:'Medium',  icon:'🟡'},
  LOW:      {color:'#6b7280',bg:'rgba(107,114,128,.1)', label:'Low',     icon:'⚪'},
}
const FIX_LABELS: Record<FixType,string> = {
  'restore':'Restore Page','redirect':'Add Redirect','update-links':'Update Links',
  'collapse-chain':'Collapse Chain','fix-hreflang':'Fix Hreflang','review':'Manual Review'
}
const REPORT_META: Record<ReportType,{icon:string;color:string;title:string;tagline:string}> = {
  '404':      {icon:'💔',color:'#dc2626',title:'404 Broken Pages',    tagline:'Pages that don\'t exist but still have links pointing to them'},
  'broken':   {icon:'🔀',color:'#ea580c',title:'Broken Redirects',    tagline:'Redirects that send visitors to a dead page'},
  'chain':    {icon:'⛓️', color:'#7c3aed',title:'Redirect Chains',    tagline:'URLs that take too many steps to reach the final page'},
  'hreflang': {icon:'🌍',color:'#0891b2',title:'Hreflang Issues',     tagline:'Language targeting signals that are broken or incomplete'},
  'unknown':  {icon:'📄',color:'#6b7280',title:'Unknown Report',      tagline:'Report type not automatically recognized'},
}
const WHAT_IS: Record<ReportType, {q:string;a:string}[]> = {
  '404': [
    {q:'What is a 404 error?', a:'A 404 means the server can\'t find the page. The URL exists in your site\'s links but the actual page has been deleted, moved, or never published.'},
    {q:'Why does it matter?', a:'Every 404 that has internal links pointing to it wastes crawl budget and link equity. Users who hit a 404 usually leave immediately.'},
    {q:'When should I use a 301 redirect?', a:'Use a 301 (permanent redirect) when a page is gone for good and you have a closely related live page to send visitors to. It passes most link equity to the new URL.'},
  ],
  'broken': [
    {q:'What is a broken redirect?', a:'A redirect exists (301 or 302) but the URL it points to returns a 404 or error. It\'s like a sign pointing to a door that doesn\'t exist.'},
    {q:'Why is this worse than a regular 404?', a:'It actively misleads crawlers and users. Link equity is passed to a dead end rather than a live page.'},
    {q:'How do I fix it?', a:'Update the redirect rule to point to a live (200) page, or restore the destination page if it should exist.'},
  ],
  'chain': [
    {q:'What is a redirect chain?', a:'When URL A redirects to URL B, which redirects to URL C, which redirects to URL D — that\'s a chain. Each hop loses a bit of link equity and slows the page down.'},
    {q:'How many hops is too many?', a:'Google recommends keeping it to 3 or fewer hops total. Ahrefs flags chains of 2+ as issues. The shorter the better.'},
    {q:'How do I collapse a chain?', a:'Update the redirect rule at the very first URL so it jumps directly to the final 200-status destination, skipping all intermediate hops.'},
  ],
  'hreflang': [
    {q:'What is hreflang?', a:'Hreflang is an HTML attribute that tells Google which language/country version of a page to show to specific users. For example: show /ar/ to Arabic speakers.'},
    {q:'What is a self-referencing hreflang tag?', a:'Every page in a hreflang cluster must include a hreflang tag that points back to itself. Without it, Google may not process the whole cluster.'},
    {q:'What is x-default?', a:'x-default is a special hreflang value for when no language/country match is found. It\'s like the fallback page for international visitors.'},
    {q:'Why must hreflang targets return 200?', a:'If a hreflang alternate returns 404 or 301, Google ignores that alternate. This means your language/country targeting breaks silently.'},
  ],
  'unknown': []
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tip({text,children}:{text:string;children:React.ReactNode}) {
  const [show, setShow] = useState(false)
  return (
    <span style={{position:'relative',display:'inline-flex',alignItems:'center',cursor:'help'}}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      {children}
      {show && <span style={{position:'absolute',bottom:'calc(100% + 6px)',left:'50%',transform:'translateX(-50%)',background:'#1e293b',color:'#f1f5f9',fontSize:'0.7rem',fontWeight:400,lineHeight:1.5,padding:'8px 12px',borderRadius:6,whiteSpace:'pre-wrap',maxWidth:260,zIndex:9999,boxShadow:'0 4px 20px rgba(0,0,0,.4)',pointerEvents:'none',width:'max-content'}}>{text}</span>}
    </span>
  )
}

// ─── Priority badge ───────────────────────────────────────────────────────────
function PBadge({p}:{p:Priority}) {
  const m = PRIORITY_META[p]
  return <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:20,fontSize:'0.62rem',fontWeight:700,background:m.bg,color:m.color,border:`1px solid ${m.color}44`,whiteSpace:'nowrap'}}>{m.icon} {m.label}</span>
}

// ─── Fix badge ────────────────────────────────────────────────────────────────
function FBadge({f,conf}:{f:FixType;conf:number}) {
  const colors: Record<FixType,string> = {
    'restore':'#0891b2','redirect':'#7c3aed','update-links':'#0369a1',
    'collapse-chain':'#6d28d9','fix-hreflang':'#0284c7','review':'#6b7280'
  }
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'2px 8px',borderRadius:20,fontSize:'0.6rem',fontWeight:600,background:`${colors[f]}15`,color:colors[f],border:`1px solid ${colors[f]}33`,whiteSpace:'nowrap'}}>
      {FIX_LABELS[f]}
      <span style={{fontSize:'0.55rem',opacity:.7}}>{conf}%</span>
    </span>
  )
}

// ─── Row Detail Panel ─────────────────────────────────────────────────────────
function DetailPanel({row,onClose,onUpdate,beginnerMode}:{row:RowIssue;onClose:()=>void;onUpdate:(patch:Partial<RowIssue>)=>void;beginnerMode:boolean}) {
  const [notes, setNotes] = useState(row.notes)
  const [assignee, setAssignee] = useState(row.assignee)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // ESC key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const save = () => onUpdate({notes, assignee})
  const copy = () => { navigator.clipboard.writeText(row.devInstruction); }

  const panelBg = isDark ? '#0f172a' : 'var(--bg)'
  const bdr = isDark ? 'rgba(255,255,255,.1)' : 'var(--border)'
  const txt = isDark ? '#f1f5f9' : 'var(--text)'
  const txt2 = isDark ? 'rgba(255,255,255,.85)' : 'var(--text-2)'
  const txt3 = isDark ? 'rgba(255,255,255,.4)' : 'var(--text-3)'
  const cardBg = isDark ? 'rgba(255,255,255,.04)' : 'var(--surface)'
  const cardBdr = isDark ? 'rgba(255,255,255,.08)' : 'var(--border)'
  const inpBg = isDark ? 'rgba(255,255,255,.06)' : 'var(--surface-3)'
  const iS: React.CSSProperties = {width:'100%',background:inpBg,border:`1px solid ${bdr}`,borderRadius:6,color:txt,fontFamily:'inherit',fontSize:'0.76rem',padding:'8px 10px',outline:'none'}

  return (
    <>
      {/* Backdrop overlay — click to close */}
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:199,backdropFilter:'blur(1px)'}}/>
      <div style={{position:'fixed',right:0,top:0,bottom:0,width:520,background:panelBg,borderLeft:`1px solid ${bdr}`,overflowY:'auto',zIndex:200,display:'flex',flexDirection:'column',boxShadow:'-8px 0 32px rgba(0,0,0,.3)'}}>
      {/* Header */}
      <div style={{padding:'16px 20px',borderBottom:`1px solid ${bdr}`,display:'flex',alignItems:'center',gap:10,flexShrink:0,background:cardBg}}>
        <PBadge p={row.priority}/>
        <span style={{flex:1,fontSize:'0.8rem',fontWeight:700,color:txt,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.url||'Issue Detail'}</span>
        <button onClick={onClose}
          title="Close (Esc)"
          style={{background:inpBg,border:`1px solid ${bdr}`,color:txt2,cursor:'pointer',fontSize:16,lineHeight:1,padding:'5px 10px',borderRadius:6,fontWeight:700,transition:'all .15s'}}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='rgba(239,68,68,.15)';(e.currentTarget as HTMLElement).style.borderColor='rgba(239,68,68,.4)';(e.currentTarget as HTMLElement).style.color='#ef4444'}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=inpBg;(e.currentTarget as HTMLElement).style.borderColor=bdr;(e.currentTarget as HTMLElement).style.color=txt2}}>
          ✕ Close
        </button>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:16}}>
        {/* Summary */}
        <div style={{background:cardBg,border:`1px solid ${cardBdr}`,borderRadius:10,padding:16}}>
          <div style={{fontSize:'0.6rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:txt3,marginBottom:8}}>Issue Summary</div>
          <div style={{fontSize:'0.88rem',fontWeight:600,color:txt,lineHeight:1.5}}>{row.summary}</div>
        </div>

        {/* Why it matters */}
        <div style={{background:'rgba(234,88,12,.07)',border:'1px solid rgba(234,88,12,.2)',borderRadius:10,padding:16}}>
          <div style={{fontSize:'0.6rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#ea580c',marginBottom:8}}>⚠ Why This Matters</div>
          <div style={{fontSize:'0.8rem',color:txt2,lineHeight:1.65}}>{row.whyMatters}</div>
        </div>

        {/* Recommended action */}
        <div style={{background:'rgba(16,185,129,.07)',border:'1px solid rgba(16,185,129,.2)',borderRadius:10,padding:16}}>
          <div style={{fontSize:'0.6rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#10b981',marginBottom:8}}>✓ Recommended Action</div>
          <div style={{fontSize:'0.8rem',color:txt2,lineHeight:1.65}}>{row.action}</div>
        </div>

        {/* Dev instruction */}
        <div style={{background:'rgba(99,102,241,.07)',border:'1px solid rgba(99,102,241,.2)',borderRadius:10,padding:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <div style={{fontSize:'0.6rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#818cf8'}}>⌨ Developer Instruction</div>
            <button onClick={copy} style={{background:'rgba(99,102,241,.2)',border:'1px solid rgba(99,102,241,.35)',borderRadius:5,color:'#818cf8',cursor:'pointer',fontSize:'0.6rem',fontWeight:600,padding:'3px 10px',fontFamily:'inherit'}}>Copy</button>
          </div>
          <pre style={{margin:0,fontFamily:'monospace',fontSize:'0.72rem',color:txt2,lineHeight:1.7,whiteSpace:'pre-wrap',wordBreak:'break-all'}}>{row.devInstruction}</pre>
        </div>

        {/* Confidence & Fix type */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div style={{background:cardBg,border:`1px solid ${cardBdr}`,borderRadius:8,padding:12}}>
            <div style={{fontSize:'0.55rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:txt3,marginBottom:6}}>Fix Type</div>
            <FBadge f={row.fixType} conf={row.confidence}/>
          </div>
          <div style={{background:cardBg,border:`1px solid ${cardBdr}`,borderRadius:8,padding:12}}>
            <div style={{fontSize:'0.55rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:txt3,marginBottom:6}}>Inlinks</div>
            <span style={{fontSize:'1.1rem',fontWeight:700,color:txt}}>{row.inlinks}</span>
          </div>
        </div>

        {/* Raw URL info */}
        {[{l:'Page URL',v:row.url},{l:'Final/Target URL',v:row.finalUrl},{l:'First Found At',v:row.source},{l:'Status Code',v:row.statusCode}].filter(x=>x.v).map(({l,v}) => (
          <div key={l} style={{background:cardBg,border:`1px solid ${cardBdr}`,borderRadius:8,padding:'10px 12px'}}>
            <div style={{fontSize:'0.55rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:txt3,marginBottom:4}}>{l}</div>
            <div style={{fontSize:'0.72rem',fontFamily:'monospace',color:txt2,wordBreak:'break-all'}}>{v}</div>
          </div>
        ))}

        {/* Assignee & Notes */}
        <div style={{background:cardBg,border:`1px solid ${cardBdr}`,borderRadius:10,padding:16,display:'flex',flexDirection:'column',gap:10}}>
          <div style={{fontSize:'0.6rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:txt3}}>Task Details</div>
          <div>
            <div style={{fontSize:'0.6rem',fontWeight:600,color:txt3,marginBottom:4}}>Assignee</div>
            <input value={assignee} onChange={e=>setAssignee(e.target.value)} onBlur={save} placeholder="e.g. Ali, Dev Team…" style={iS}/>
          </div>
          <div>
            <div style={{fontSize:'0.6rem',fontWeight:600,color:txt3,marginBottom:4}}>Notes</div>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} onBlur={save} rows={3} placeholder="Add any notes, context, or follow-up…" style={{...iS,resize:'vertical',minHeight:70}}/>
          </div>
          <button onClick={() => { onUpdate({fixed:!row.fixed}); }}
            style={{padding:'8px',borderRadius:7,border:'1px solid',cursor:'pointer',fontFamily:'inherit',fontSize:'0.72rem',fontWeight:700,transition:'all .15s',
              background: row.fixed ? 'rgba(16,185,129,.15)' : inpBg,
              borderColor: row.fixed ? 'rgba(16,185,129,.4)' : bdr,
              color: row.fixed ? '#10b981' : txt2}}>
            {row.fixed ? '✓ Marked as Fixed' : 'Mark as Fixed'}
          </button>
        </div>

        {/* Beginner tips */}
        {beginnerMode && WHAT_IS[row.priority === 'LOW' ? 'unknown' : 'unknown'] && null}
      </div>
    </div>
    </>
  )
}

// ─── Collapsible Guide ────────────────────────────────────────────────────────
function Guide({type, beginnerMode}:{type:ReportType;beginnerMode:boolean}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [openWhat, setOpenWhat] = useState(false)
  const [openPlay, setOpenPlay] = useState(false)
  const [openFaq, setOpenFaq] = useState(false)
  const meta = REPORT_META[type]
  const faqs = WHAT_IS[type]
  const guideColors = isDark ? {
    border: 'rgba(255,255,255,.08)',
    bg: 'rgba(255,255,255,.03)',
    text: 'rgba(255,255,255,.8)',
    text2: 'rgba(255,255,255,.75)',
    text3: 'rgba(255,255,255,.65)',
    text4: 'rgba(255,255,255,.55)',
    border2: 'rgba(255,255,255,.07)',
    border3: 'rgba(255,255,255,.06)',
    bg2: 'rgba(255,255,255,.04)',
  } : {
    border: 'var(--border)',
    bg: 'var(--surface-2)',
    text: 'var(--text-2)',
    text2: 'var(--text-2)',
    text3: 'var(--text-3)',
    text4: 'var(--text-3)',
    border2: 'var(--border)',
    border3: 'var(--border)',
    bg2: 'var(--surface-3)',
  }

  const playbooks: Record<ReportType,{step:string;title:string;desc:string;priority:'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'}[]> = {
    '404': [
      {step:'1',priority:'CRITICAL',title:'Fix high-inlink dead pages immediately',desc:'Any page with 20+ internal links pointing to it that returns 404 is losing significant link equity. Add a 301 redirect to the closest matching live page now.'},
      {step:'2',priority:'HIGH',title:'Update the source links',desc:'Don\'t just redirect — also update the internal links on the pages that link here. This avoids the redirect hop entirely.'},
      {step:'3',priority:'MEDIUM',title:'Handle moderate-traffic dead pages',desc:'Pages with 5–20 inlinks. Add redirects and update links when time allows.'},
      {step:'4',priority:'LOW',title:'Clean up orphaned 404s',desc:'Pages with zero inlinks. Remove them from sitemaps and any remaining references.'},
    ],
    'broken': [
      {step:'1',priority:'CRITICAL',title:'Fix redirect destinations with high inlinks first',desc:'Update the redirect rule — the destination must be a live 200 page. Check if the destination page was accidentally deleted or moved again.'},
      {step:'2',priority:'HIGH',title:'Update internal links to the final URL',desc:'Wherever possible, link directly to the final destination URL. This avoids the redirect hop entirely.'},
      {step:'3',priority:'MEDIUM',title:'Audit all 301 targets in your redirect rules',desc:'Run a bulk check on all redirect destinations to find any others pointing to non-200 URLs.'},
    ],
    'chain': [
      {step:'1',priority:'CRITICAL',title:'Collapse long chains (5+ hops) immediately',desc:'Every hop loses PageRank. A 5-hop chain loses significant ranking power. Update the redirect at the first URL to jump directly to the final 200 page.'},
      {step:'2',priority:'HIGH',title:'Collapse medium chains (3–4 hops)',desc:'Still significant loss. Prioritize high-traffic URLs first. Update to single-hop redirects.'},
      {step:'3',priority:'MEDIUM',title:'Handle 2-hop chains',desc:'Less urgent, but still worth fixing. Especially important for pages with high inlinks.'},
      {step:'4',priority:'LOW',title:'Update internal links to final URLs',desc:'After collapsing chains, update internal links to point directly to final destinations — no redirects at all.'},
    ],
    'hreflang': [
      {step:'1',priority:'CRITICAL',title:'Fix all 404 hreflang targets immediately',desc:'A broken hreflang target causes Google to ignore the entire language cluster for that page. Replace with a live 200 URL.'},
      {step:'2',priority:'HIGH',title:'Replace all redirected hreflang targets',desc:'Use the final 200 URL in every hreflang tag — never use a URL that redirects.'},
      {step:'3',priority:'HIGH',title:'Add missing self-referencing tags',desc:'Every page in a hreflang cluster must reference itself. Without this, Google may reject the whole cluster.'},
      {step:'4',priority:'MEDIUM',title:'Add x-default where missing',desc:'Add an x-default hreflang tag pointing to the default fallback URL for users whose language/country isn\'t matched.'},
    ],
    'unknown': [],
  }

  const steps = playbooks[type]
  const Chevron = ({open}:{open:boolean}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{transition:'transform .2s',transform:open?'rotate(180deg)':'none',flexShrink:0}}><path d="m6 9 6 6 6-6"/></svg>
  )

  const Section = ({open, onToggle, label, children}:{open:boolean;onToggle:()=>void;label:string;children:React.ReactNode}) => (
    <div style={{border:`1px solid ${guideColors.border}`,borderRadius:10,overflow:'hidden',marginBottom:10}}>
      <button onClick={onToggle} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:guideColors.bg,border:'none',cursor:'pointer',color:guideColors.text,fontFamily:'inherit',fontSize:'0.78rem',fontWeight:600,letterSpacing:'.02em',textAlign:'left'}}>
        <span style={{flex:1}}>{label}</span>
        <Chevron open={open}/>
      </button>
      {open && <div style={{padding:'14px 16px',borderTop:`1px solid ${guideColors.border3}`}}>{children}</div>}
    </div>
  )

  return (
    <div style={{marginBottom:16}}>
      <Section open={openWhat} onToggle={()=>setOpenWhat(x=>!x)} label={`📖 What this report means — ${meta.tagline}`}>
        <p style={{fontSize:'0.8rem',color:guideColors.text2,lineHeight:1.7,margin:'0 0 12px'}}>{meta.tagline}. {beginnerMode ? 'This guide will help you understand what each issue means, why it matters, and exactly what to do about it.' : 'Use the priority engine below to decide what to fix first.'}</p>
        {faqs.length > 0 && (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {faqs.map(({q,a}) => (
              <details key={q} style={{background:guideColors.bg2,border:`1px solid ${guideColors.border2}`,borderRadius:7,padding:'10px 12px'}}>
                <summary style={{fontSize:'0.76rem',fontWeight:600,color:guideColors.text,cursor:'pointer',listStyle:'none',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  {q} <span style={{color:guideColors.text3,fontSize:12}}>▼</span>
                </summary>
                <p style={{margin:'10px 0 0',fontSize:'0.76rem',color:guideColors.text3,lineHeight:1.65}}>{a}</p>
              </details>
            ))}
          </div>
        )}
      </Section>

      <Section open={openPlay} onToggle={()=>setOpenPlay(x=>!x)} label="📋 Fix Playbook — Where to start">
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {steps.map(s => (
            <div key={s.step} style={{display:'flex',gap:12,padding:'10px 12px',background:guideColors.bg,border:`1px solid ${guideColors.border3}`,borderRadius:8}}>
              <div style={{width:24,height:24,borderRadius:'50%',background:PRIORITY_META[s.priority].bg,border:`1px solid ${PRIORITY_META[s.priority].color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.65rem',fontWeight:700,color:PRIORITY_META[s.priority].color,flexShrink:0}}>{s.step}</div>
              <div>
                <div style={{fontSize:'0.76rem',fontWeight:700,color:guideColors.text,marginBottom:3,display:'flex',alignItems:'center',gap:6}}>
                  {s.title} <PBadge p={s.priority}/>
                </div>
                {beginnerMode && <div style={{fontSize:'0.72rem',color:guideColors.text4,lineHeight:1.6}}>{s.desc}</div>}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {faqs.length > 0 && (
        <Section open={openFaq} onToggle={()=>setOpenFaq(x=>!x)} label="❓ SEO Terms Explained">
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {faqs.map(({q,a}) => (
              <div key={q} style={{padding:'10px 12px',background:guideColors.bg,borderRadius:7,border:`1px solid ${guideColors.border3}`}}>
                <div style={{fontSize:'0.72rem',fontWeight:700,color:guideColors.text,marginBottom:4}}>{q}</div>
                <div style={{fontSize:'0.7rem',color:guideColors.text4,lineHeight:1.6}}>{a}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function SEOToolPage() {
  const [files, setFiles] = useState<SeoFile[]>([])
  const [activeId, setActiveId] = useState<string|null>(null)
  const [meta, setMetaState] = useState<MetaMap>(loadMeta)
  const [search, setSearch] = useState('')
  const [pFilter, setPFilter] = useState<Priority|''>('')
  const [fixFilter, setFixFilter] = useState<FixType|''>('')
  const [hideFixed, setHideFixed] = useState(false)
  const [detailRow, setDetailRow] = useState<RowIssue|null>(null)
  const [sortCol, setSortCol] = useState<'priority'|'inlinks'|'url'>('priority')
  const [sortDir, setSortDir] = useState<1|-1>(-1)
  const [beginnerMode, setBeginnerMode] = useState(true)
  const [renaming, setRenaming] = useState<string|null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const activeFile = files.find(f => f.id === activeId) || null

  function updateMeta(id: string, patch: {fixed?:boolean;assignee?:string;notes?:string}) {
    setMetaState(prev => {
      const next = {...prev, [id]: {...prev[id], ...patch}}
      saveMeta(next)
      return next
    })
    if (detailRow?.id === id) setDetailRow(r => r ? {...r,...patch} : r)
  }

  function updateRow(fileId: string, rowId: string, patch: Partial<RowIssue>) {
    updateMeta(rowId, {fixed: patch.fixed??meta[rowId]?.fixed, assignee: patch.assignee??meta[rowId]?.assignee, notes: patch.notes??meta[rowId]?.notes})
    setFiles(prev => prev.map(f => f.id!==fileId ? f : {
      ...f, rows: f.rows.map(r => r.id!==rowId ? r : {...r,...patch})
    }))
    if (detailRow?.id === rowId) setDetailRow(r => r ? {...r,...patch} : r)
  }

  function processFile(file: File) {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data as Record<string, string>[]
        const headers = res.meta.fields || []
        const type = detectType(file.name, headers, rows)
        const built = rows.map(raw => buildRow(type, raw, undefined))
        const id = `f_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
        const newFile: SeoFile = { id, name: file.name.replace(/\.csv$/i,''), type, rows: built, uploadedAt: Date.now(), headers }
        setFiles(prev => [...prev, newFile])
        setActiveId(id)
      }
    })
  }

  function loadSample(type: ReportType, label: string, csv: string) {
    const blob = new Blob([csv], {type:'text/csv'})
    const f = new File([blob], `${label}.csv`)
    processFile(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    Array.from(e.dataTransfer.files).filter(f=>/\.csv$/i.test(f.name)).forEach(processFile)
  }

  // Build filtered/sorted rows
  const PRIORITY_ORDER: Record<Priority,number> = {CRITICAL:4,HIGH:3,MEDIUM:2,LOW:1}
  const rows = (activeFile?.rows || []).filter(r => {
    if (hideFixed && r.fixed) return false
    if (pFilter && r.priority !== pFilter) return false
    if (fixFilter && r.fixType !== fixFilter) return false
    const q = search.toLowerCase()
    if (q && !r.url.toLowerCase().includes(q) && !r.summary.toLowerCase().includes(q) && !r.finalUrl.toLowerCase().includes(q)) return false
    return true
  }).sort((a,b) => {
    if (sortCol==='priority') return (PRIORITY_ORDER[a.priority]-PRIORITY_ORDER[b.priority]) * sortDir
    if (sortCol==='inlinks') return (a.inlinks-b.inlinks) * sortDir
    return a.url.localeCompare(b.url) * sortDir
  })

  const allRows = activeFile?.rows || []
  const stats = {
    total: allRows.length,
    critical: allRows.filter(r=>r.priority==='CRITICAL').length,
    high: allRows.filter(r=>r.priority==='HIGH').length,
    medium: allRows.filter(r=>r.priority==='MEDIUM').length,
    low: allRows.filter(r=>r.priority==='LOW').length,
    fixed: allRows.filter(r=>r.fixed).length,
  }

  function exportCSV() {
    if (!activeFile) return
    const cols = ['URL','Final URL','Source','Status','Priority','Fix Type','Confidence %','Summary','Action','Assignee','Notes','Fixed']
    const lines = [cols.join(','), ...rows.map(r => [
      `"${r.url}"`,`"${r.finalUrl}"`,`"${r.source}"`,r.statusCode,
      r.priority, FIX_LABELS[r.fixType], r.confidence,
      `"${r.summary.replace(/"/g,'""')}"`,`"${r.action.replace(/"/g,'""')}"`,
      `"${r.assignee}"`,`"${r.notes.replace(/"/g,'""')}"`,r.fixed?'Yes':'No'
    ].join(','))]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/csv'}))
    a.download = `${activeFile.name}-actions-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  function exportDevTasks() {
    if (!activeFile) return
    const lines = [`SEO Action List — ${activeFile.name} — ${new Date().toLocaleDateString()}`, '='.repeat(60), '',
      ...rows.filter(r=>!r.fixed).map((r,i) => [
        `${i+1}. [${r.priority}] ${r.url}`, `   ${r.summary}`, `   ACTION: ${r.action}`,
        `   DEVELOPER: ${r.devInstruction.replace(/\n/g,'\n   ')}`, ''
      ].join('\n'))
    ]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain'}))
    a.download = `${activeFile.name}-devtasks-${new Date().toISOString().slice(0,10)}.txt`
    a.click()
  }

  function copySlack() {
    if (!activeFile) return
    const m = REPORT_META[activeFile.type]
    const txt = [
      `*${m.icon} SEO Report: ${activeFile.name}*`,
      `> ${m.tagline}`,``,
      `*Issues Found:* ${stats.total}`,
      `🔴 Critical: ${stats.critical} | 🟠 High: ${stats.high} | 🟡 Medium: ${stats.medium} | ⚪ Low: ${stats.low}`,
      `✅ Fixed: ${stats.fixed}/${stats.total}`,``,
      `*Top Issues:*`,
      ...rows.slice(0,5).map((r,i) => `${i+1}. [${r.priority}] ${r.url}\n   ${r.summary}`)
    ].join('\n')
    navigator.clipboard.writeText(txt)
  }

  const SortBtn = ({col,label}:{col:typeof sortCol;label:string}) => (
    <button onClick={()=>{ if(sortCol===col) setSortDir(d=>d===-1?1:-1); else {setSortCol(col);setSortDir(-1)} }}
      style={{background:'none',border:'none',cursor:'pointer',color: sortCol===col?sc.text:sc.text3,fontFamily:'inherit',fontSize:'0.62rem',fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',display:'flex',alignItems:'center',gap:3,whiteSpace:'nowrap'}}>
      {label} {sortCol===col ? (sortDir===-1?'↓':'↑') : ''}
    </button>
  )

  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const sc = isDark ? {
    bg: '#0b1120', sidebar: '#070d1a', sidebarBdr: 'rgba(255,255,255,.07)',
    secBdr: 'rgba(255,255,255,.06)', card: 'rgba(255,255,255,.04)',
    cardBdr: 'rgba(255,255,255,.08)', text: '#f1f5f9', text2: 'rgba(255,255,255,.7)',
    text3: 'rgba(255,255,255,.4)', textMuted: 'rgba(255,255,255,.25)',
    textFaint: 'rgba(255,255,255,.15)', inpBg: 'rgba(255,255,255,.06)',
    inpBdr: 'rgba(255,255,255,.1)', rowHover: 'rgba(255,255,255,.035)',
    hdrBg: 'rgba(255,255,255,.02)', action: 'rgba(255,255,255,.5)',
    btnBg: 'rgba(255,255,255,.06)', btnBdr: 'rgba(255,255,255,.12)', btnTxt: 'rgba(255,255,255,.7)',
  } : {
    bg: 'var(--bg)', sidebar: 'var(--surface)', sidebarBdr: 'var(--border)',
    secBdr: 'var(--border)', card: 'var(--surface)', cardBdr: 'var(--border)',
    text: 'var(--text)', text2: 'var(--text-2)', text3: 'var(--text-3)',
    textMuted: 'var(--text-3)', textFaint: 'rgba(0,0,0,.1)', inpBg: 'var(--surface-3)',
    inpBdr: 'var(--border)', rowHover: 'rgba(0,0,0,.03)', hdrBg: 'rgba(0,0,0,.02)',
    action: 'var(--text-2)', btnBg: 'var(--surface-2)', btnBdr: 'var(--border)', btnTxt: 'var(--text-2)',
  }

  return (
    <div style={{minHeight:'100vh',background:sc.bg,color:sc.text,fontFamily:"'Inter',sans-serif",display:'flex',flexDirection:'column'}}>
      <TopNav currentPage="seo"/>

      <div style={{display:'flex',flex:1,marginTop:60,minHeight:'calc(100vh - 60px)'}}>
        {/* ── Sidebar ── */}
        <aside style={{width:240,flexShrink:0,background:sc.sidebar,borderRight:`1px solid ${sc.sidebarBdr}`,display:'flex',flexDirection:'column',overflowY:'auto'}}>
          <div style={{padding:'14px 14px 8px',borderBottom:`1px solid ${sc.secBdr}`,flexShrink:0}}>
            <div style={{fontSize:'0.6rem',fontWeight:700,letterSpacing:'.14em',textTransform:'uppercase',color:sc.textMuted,marginBottom:10}}>SEO Reports</div>
            <button onClick={()=>fileRef.current?.click()}
              style={{width:'100%',background:'var(--accent-grad)',border:'none',borderRadius:7,color:'#fff',fontFamily:'inherit',fontSize:'0.7rem',fontWeight:700,padding:'8px',cursor:'pointer',boxShadow:'0 2px 10px rgba(233,30,140,.25)',letterSpacing:'.04em'}}>
              + Upload CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv" multiple style={{display:'none'}} onChange={e=>{Array.from(e.target.files||[]).forEach(processFile);e.target.value=''}}/>
          </div>

          {/* Sample loader — moved to bottom near beginner toggle */}

          {/* File list */}
          <div style={{flex:1,overflowY:'auto',padding:'8px 8px'}}>
            {files.length === 0 && (
              <div style={{padding:'12px 6px',fontSize:'0.65rem',color:sc.textMuted,lineHeight:1.6,textAlign:'center'}}>
                No files yet.<br/>Upload a CSV or try a demo file above.
              </div>
            )}
            {(['404','broken','chain','hreflang','unknown'] as ReportType[]).map(type => {
              const group = files.filter(f=>f.type===type)
              if (!group.length) return null
              const m = REPORT_META[type]
              return (
                <div key={type} style={{marginBottom:10}}>
                  <div style={{fontSize:'0.56rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:sc.textMuted,padding:'4px 6px',display:'flex',alignItems:'center',gap:5}}>
                    {m.icon} {m.title}
                  </div>
                  {group.map(f => (
                    <div key={f.id} style={{borderRadius:6,marginBottom:2,background: activeId===f.id ? 'rgba(233,30,140,.15)' : sc.card,border:`1px solid ${activeId===f.id ? 'rgba(233,30,140,.35)' : sc.cardBdr}`,cursor:'pointer',transition:'all .15s',padding:'7px 10px'}}
                      onClick={()=>setActiveId(f.id)}>
                      {renaming===f.id ? (
                        <input autoFocus defaultValue={f.name}
                          style={{width:'100%',background:'none',border:'none',outline:'none',color:sc.text,fontFamily:'inherit',fontSize:'0.7rem',fontWeight:600}}
                          onBlur={e=>{setFiles(prev=>prev.map(x=>x.id===f.id?{...x,name:e.target.value}:x));setRenaming(null)}}
                          onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Escape') (e.target as HTMLInputElement).blur() }}/>
                      ) : (
                        <>
                          <div style={{fontSize:'0.7rem',fontWeight:600,color: activeId===f.id?sc.text:sc.text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</div>
                          <div style={{display:'flex',alignItems:'center',gap:6,marginTop:3}}>
                            <span style={{fontSize:'0.58rem',color:sc.text3}}>{f.rows.length} issues</span>
                            <button onClick={e=>{e.stopPropagation();setRenaming(f.id)}} style={{background:'none',border:'none',cursor:'pointer',color:sc.text3,fontSize:11,padding:0}}>✎</button>
                            <button onClick={e=>{e.stopPropagation();setFiles(p=>p.filter(x=>x.id!==f.id));if(activeId===f.id)setActiveId(null)}} style={{background:'none',border:'none',cursor:'pointer',color:sc.textFaint,fontSize:11,padding:0,marginLeft:'auto'}}>×</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {/* Demo Files — near beginner toggle */}
          <div style={{padding:'8px 14px',borderTop:`1px solid ${sc.secBdr}`,flexShrink:0}}>
            <div style={{fontSize:'0.52rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:sc.textFaint,marginBottom:5}}>Demo Files</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:3}}>
              {[
                {t:'404' as ReportType,label:'404 Pages',csv:SAMPLE_404},
                {t:'broken' as ReportType,label:'Broken Redirects',csv:SAMPLE_BROKEN},
                {t:'chain' as ReportType,label:'Redirect Chains',csv:SAMPLE_CHAIN},
                {t:'hreflang' as ReportType,label:'Hreflang Issues',csv:SAMPLE_HREFLANG},
              ].map(({t,label,csv})=>(
                <button key={t} onClick={()=>loadSample(t,label,csv)}
                  style={{textAlign:'left',background:sc.card,border:`1px solid ${sc.cardBdr}`,borderRadius:5,color:sc.text3,fontFamily:'inherit',fontSize:'0.58rem',padding:'4px 7px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,lineHeight:1.2}}>
                  <span style={{fontSize:10}}>{REPORT_META[t].icon}</span>{label}
                </button>
              ))}
            </div>
          </div>

          {/* Beginner toggle */}
          <div style={{padding:'10px 14px',borderTop:`1px solid ${sc.secBdr}`,flexShrink:0}}>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
              <div style={{width:32,height:18,borderRadius:9,background: beginnerMode?'var(--accent)':sc.inpBg,position:'relative',transition:'all .2s',flexShrink:0}}>
                <div style={{position:'absolute',top:2,left: beginnerMode?14:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left .2s'}}/>
              </div>
              <div>
                <div style={{fontSize:'0.65rem',fontWeight:600,color:sc.text2}}>Beginner Mode</div>
                <div style={{fontSize:'0.55rem',color:sc.text3}}>{beginnerMode?'More guidance':'Expert summaries'}</div>
              </div>
              <input type="checkbox" checked={beginnerMode} onChange={e=>setBeginnerMode(e.target.checked)} style={{display:'none'}}/>
            </label>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>

          {/* Empty state / drop zone */}
          {!activeFile && (
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'2rem'}}
              onDragOver={e=>{e.preventDefault();setDragging(true)}}
              onDragLeave={()=>setDragging(false)}
              onDrop={handleDrop}>
              <div style={{maxWidth:520,textAlign:'center'}}>
                <div style={{width:72,height:72,borderRadius:16,background:isDark?'rgba(233,30,140,.1)':'rgba(233,30,140,.08)',border:`2px dashed ${isDark?'rgba(233,30,140,.3)':'rgba(233,30,140,.25)'}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:30,transition:'all .2s',boxShadow: dragging?'0 0 0 4px rgba(233,30,140,.2)':'none'}}>📊</div>
                <h2 style={{fontSize:'1.3rem',fontWeight:800,color:sc.text,letterSpacing:'.03em',marginBottom:10}}>Ahrefs SEO Report Fixer</h2>
                <p style={{fontSize:'0.82rem',color:sc.text2,lineHeight:1.7,marginBottom:24}}>Upload a CSV export from Ahrefs and instantly understand every issue, what it means, and exactly how to fix it — even if you're not deeply technical.</p>
                <div style={{display:'flex',gap:10,justifyContent:'center',marginBottom:24}}>
                  <button onClick={()=>fileRef.current?.click()} style={{background:'var(--accent-grad)',border:'none',borderRadius:8,color:'#fff',fontFamily:'inherit',fontSize:'0.76rem',fontWeight:700,padding:'10px 22px',cursor:'pointer',boxShadow:'0 2px 14px rgba(233,30,140,.3)'}}>Upload CSV File</button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
                  {(['404','broken','chain','hreflang'] as ReportType[]).map(t=>{
                    const m = REPORT_META[t]
                    return (
                      <div key={t} style={{padding:'12px',background:isDark?'rgba(255,255,255,.04)':'rgba(0,0,0,.03)',border:`1px solid ${isDark?'rgba(255,255,255,.08)':'rgba(0,0,0,.08)'}`,borderRadius:8,textAlign:'left'}}>
                        <div style={{fontSize:'1.2rem',marginBottom:5}}>{m.icon}</div>
                        <div style={{fontSize:'0.72rem',fontWeight:700,color:isDark?'rgba(255,255,255,.85)':'rgba(0,0,0,.85)',marginBottom:3}}>{m.title}</div>
                        <div style={{fontSize:'0.65rem',color:isDark?'rgba(255,255,255,.4)':'rgba(0,0,0,.5)',lineHeight:1.5}}>{m.tagline}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* File view */}
          {activeFile && (
            <div style={{flex:1,padding:'20px 24px'}}>
              {/* Report header */}
              <div style={{display:'flex',alignItems:'flex-start',gap:14,marginBottom:18,flexWrap:'wrap'}}>
                <div style={{width:44,height:44,borderRadius:10,background:`${REPORT_META[activeFile.type].color}18`,border:`1px solid ${REPORT_META[activeFile.type].color}35`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>
                  {REPORT_META[activeFile.type].icon}
                </div>
                <div style={{flex:1,minWidth:200}}>
                  <h1 style={{fontSize:'1.1rem',fontWeight:800,color:sc.text,letterSpacing:'.03em',marginBottom:3}}>{activeFile.name}</h1>
                  <div style={{fontSize:'0.72rem',color:sc.text3}}>{REPORT_META[activeFile.type].title} · {REPORT_META[activeFile.type].tagline}</div>
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  <button onClick={exportCSV} style={{background:sc.btnBg,border:`1px solid ${sc.btnBdr}`,borderRadius:6,color:sc.btnTxt,fontFamily:'inherit',fontSize:'0.65rem',fontWeight:600,padding:'6px 12px',cursor:'pointer'}}>↓ Export CSV</button>
                  <button onClick={exportDevTasks} style={{background:sc.btnBg,border:`1px solid ${sc.btnBdr}`,borderRadius:6,color:sc.btnTxt,fontFamily:'inherit',fontSize:'0.65rem',fontWeight:600,padding:'6px 12px',cursor:'pointer'}}>↓ Dev Tasks</button>
                  <button onClick={copySlack} style={{background:sc.btnBg,border:`1px solid ${sc.btnBdr}`,borderRadius:6,color:sc.btnTxt,fontFamily:'inherit',fontSize:'0.65rem',fontWeight:600,padding:'6px 12px',cursor:'pointer'}}>📋 Copy for Slack</button>
                </div>
              </div>

              {/* Summary cards */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:8,marginBottom:18}}>
                {[
                  {label:'Total Issues',n:stats.total,color:'#94a3b8',sub:''},
                  {label:'Critical',n:stats.critical,color:PRIORITY_META.CRITICAL.color,sub:'Fix now'},
                  {label:'High',n:stats.high,color:PRIORITY_META.HIGH.color,sub:'This week'},
                  {label:'Medium',n:stats.medium,color:PRIORITY_META.MEDIUM.color,sub:'Plan for'},
                  {label:'Low',n:stats.low,color:PRIORITY_META.LOW.color,sub:'Backlog'},
                  {label:'Fixed',n:stats.fixed,color:'#10b981',sub:`of ${stats.total}`},
                ].map(({label,n,color,sub}) => (
                  <div key={label} style={{padding:'12px 14px',background:sc.card,border:`1px solid ${sc.cardBdr}`,borderRadius:10}}>
                    <div style={{fontSize:'1.4rem',fontWeight:800,color,lineHeight:1,marginBottom:3}}>{n}</div>
                    <div style={{fontSize:'0.62rem',fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase',color:sc.text3}}>{label}</div>
                    {sub && <div style={{fontSize:'0.58rem',color:sc.textMuted,marginTop:1}}>{sub}</div>}
                  </div>
                ))}
                {/* Progress bar */}
                <div style={{padding:'12px 14px',background:sc.card,border:`1px solid ${sc.cardBdr}`,borderRadius:10,gridColumn:'span 2',display:'flex',flexDirection:'column',justifyContent:'center',gap:5}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.6rem',color:sc.text3}}>
                    <span>Progress</span>
                    <span>{stats.total ? Math.round(stats.fixed/stats.total*100) : 0}%</span>
                  </div>
                  <div style={{height:5,background:sc.inpBg,borderRadius:3,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${stats.total?stats.fixed/stats.total*100:0}%`,background:'linear-gradient(90deg,#10b981,#34d399)',borderRadius:3,transition:'width .5s'}}/>
                  </div>
                </div>
              </div>

              {/* Guide */}
              <Guide type={activeFile.type} beginnerMode={beginnerMode}/>

              {/* Filters */}
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:12}}>
                <div style={{position:'relative',flex:1,minWidth:200}}>
                  <svg style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:sc.text3,pointerEvents:'none'}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search URLs, summaries…"
                    style={{width:'100%',paddingLeft:32,paddingRight:10,paddingTop:7,paddingBottom:7,background:sc.inpBg,border:`1px solid ${sc.inpBdr}`,borderRadius:7,color:sc.text,fontFamily:'inherit',fontSize:'0.72rem',outline:'none'}}/>
                </div>
                <select value={pFilter} onChange={e=>setPFilter(e.target.value as Priority|'')}
                  style={{padding:'7px 10px',background:sc.inpBg,border:`1px solid ${sc.inpBdr}`,borderRadius:7,color:sc.text2,fontFamily:'inherit',fontSize:'0.7rem',outline:'none',cursor:'pointer',colorScheme: isDark ? 'dark' : 'light'}}>
                  <option value=''>All Priorities</option>
                  {(['CRITICAL','HIGH','MEDIUM','LOW'] as Priority[]).map(p=><option key={p} value={p}>{PRIORITY_META[p].icon} {PRIORITY_META[p].label}</option>)}
                </select>
                <select value={fixFilter} onChange={e=>setFixFilter(e.target.value as FixType|'')}
                  style={{padding:'7px 10px',background:sc.inpBg,border:`1px solid ${sc.inpBdr}`,borderRadius:7,color:sc.text2,fontFamily:'inherit',fontSize:'0.7rem',outline:'none',cursor:'pointer',colorScheme: isDark ? 'dark' : 'light'}}>
                  <option value=''>All Fix Types</option>
                  {Object.entries(FIX_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
                <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:'0.68rem',color:sc.text3,whiteSpace:'nowrap'}}>
                  <input type="checkbox" checked={hideFixed} onChange={e=>setHideFixed(e.target.checked)} style={{accentColor:'var(--accent)',width:13,height:13}}/>
                  Hide Fixed
                </label>
                <span style={{fontSize:'0.62rem',color:sc.textMuted,whiteSpace:'nowrap'}}>{rows.length} shown</span>
              </div>

              {/* Table */}
              <div style={{background:sc.card,border:`1px solid ${sc.cardBdr}`,borderRadius:10,overflow:'hidden'}}>
                {/* Table header */}
                <div style={{display:'grid',gridTemplateColumns:'28px 120px 1fr 160px 100px 100px 70px',padding:'8px 14px',borderBottom:`1px solid ${sc.cardBdr}`,gap:8,alignItems:'center',background:sc.hdrBg}}>
                  <span/>
                  <SortBtn col="priority" label="Priority"/>
                  <SortBtn col="url" label="Issue"/>
                  <span style={{fontSize:'0.6rem',fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:sc.text3}}>Recommended Fix</span>
                  <span style={{fontSize:'0.6rem',fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:sc.text3}}>Fix Type</span>
                  <SortBtn col="inlinks" label="Inlinks"/>
                  <span style={{fontSize:'0.6rem',fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:sc.text3}}>Done</span>
                </div>

                {rows.length === 0 ? (
                  <div style={{padding:'40px',textAlign:'center',color:sc.textMuted,fontSize:'0.8rem'}}>
                    {allRows.length===0 ? 'No issues found in this file.' : 'No results match your filters.'}
                  </div>
                ) : (
                  <div>
                    {rows.map((row, i) => (
                      <div key={row.id}
                        onClick={()=>setDetailRow(row)}
                        style={{display:'grid',gridTemplateColumns:'28px 120px 1fr 160px 100px 100px 70px',padding:'10px 14px',gap:8,alignItems:'start',borderBottom: i<rows.length-1?`1px solid ${sc.secBdr}`:'none',cursor:'pointer',transition:'background .1s',background: row.fixed ? 'rgba(16,185,129,.04)' : 'transparent'}}
                        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=row.fixed?'rgba(16,185,129,.07)':sc.rowHover}
                        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=row.fixed?'rgba(16,185,129,.04)':'transparent'}>

                        {/* Checkbox */}
                        <input type="checkbox" checked={row.fixed} onClick={e=>e.stopPropagation()}
                          onChange={e=>updateRow(activeFile.id, row.id, {fixed:e.target.checked})}
                          style={{accentColor:'#10b981',width:14,height:14,marginTop:2,cursor:'pointer'}}/>

                        {/* Priority */}
                        <div style={{paddingTop:1}}><PBadge p={row.priority}/></div>

                        {/* Issue */}
                        <div>
                          <div style={{fontSize:'0.72rem',fontFamily:'monospace',color: row.fixed?sc.textMuted:sc.text2,textDecoration:row.fixed?'line-through':'none',wordBreak:'break-all',lineHeight:1.4,marginBottom:4}}>{row.url}</div>
                          <div style={{fontSize:'0.68rem',color:row.fixed?sc.textMuted:sc.text3,lineHeight:1.5}}>{row.summary}</div>
                          {row.assignee && <div style={{fontSize:'0.6rem',color:sc.textMuted,marginTop:3}}>👤 {row.assignee}</div>}
                        </div>

                        {/* Action */}
                        <div style={{fontSize:'0.66rem',color:sc.action,lineHeight:1.55}}>{row.action.slice(0,110)}{row.action.length>110?'…':''}</div>

                        {/* Fix type */}
                        <div><FBadge f={row.fixType} conf={row.confidence}/></div>

                        {/* Inlinks */}
                        <div style={{fontSize:'0.78rem',fontWeight:700,color: row.inlinks>=50?'#ef4444': row.inlinks>=10?'#f97316':sc.text3,textAlign:'center'}}>{row.inlinks || '—'}</div>

                        {/* Done */}
                        <div style={{textAlign:'center',fontSize:'0.7rem',color:row.fixed?'#10b981':isDark?'rgba(255,255,255,.2)':sc.textMuted}}>
                          {row.fixed ? '✓' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Detail panel */}
      {detailRow && (
        <DetailPanel
          row={detailRow}
          onClose={()=>setDetailRow(null)}
          beginnerMode={beginnerMode}
          onUpdate={patch=>{
            if (activeFile) updateRow(activeFile.id, detailRow.id, patch)
            setDetailRow(r=>r?{...r,...patch}:r)
          }}/>
      )}
    </div>
  )
}
