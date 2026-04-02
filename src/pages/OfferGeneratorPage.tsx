import { useState, useRef } from 'react'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'
import JSZip from 'jszip'

// ─── XML helpers ─────────────────────────────────────────────────────────────
const WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
function wq(el: Element | Document, tag: string) { return Array.from(el.getElementsByTagNameNS(WNS, tag)) }
function cellAllText(tc: Element): string { return wq(tc,'p').map(p => wq(p,'r').map(r => wq(r,'t').map(t => t.textContent).join('')).join('')).join('\n') }
function cellFirstLine(tc: Element): string { for (const p of wq(tc,'p')) { const t = wq(p,'r').map(r => wq(r,'t').map(t => t.textContent).join('')).join('').trim(); if (t) return t } return '' }

function textToHtml(raw: string): string {
  if (!raw?.trim()) return ''
  const lines = raw.split('\n').map(l => l.replace(/[\u00a0\u202f\u200b]+/g,' ').trim()).filter(Boolean)
  if (!lines.length) return ''
  function isHeader(l: string) { return l.length <= 80 && /[:\uFF1A]\s*$/.test(l) && !/^[-*\u2022]/.test(l) }
  function isDisc(l: string) { return /^[-\u2013\u2014\u2022]/.test(l) || /(terms|conditions|please contact|enquiry)/i.test(l) }
  const hi = lines.findIndex(isHeader)
  if (hi === -1) return `<p>${lines.join('<br>\n')}</p>`
  const intro = lines.slice(0, hi), header = lines[hi], after = lines.slice(hi + 1)
  const items: string[] = [], subs: string[] = []
  let inSub = false
  for (const ln of after) {
    if (inSub || isDisc(ln)) { inSub = true; subs.push(ln.replace(/^[-\u2013\u2014\u2022\s]+/,'').trim()) }
    else items.push(ln.replace(/^[*\u2022]\s*/,'').trim())
  }
  const parts: string[] = []
  if (intro.length) parts.push(`<p>${intro.join('<br>\n')}</p>`)
  parts.push(`<p><b>${header}</b></p>`)
  if (items.length) parts.push(`<ul>\n${items.map(x=>`  <li>${x}</li>`).join('\n')}\n</ul>`)
  if (subs.length) parts.push(`<sub>- ${subs.join('<br>\n- ')}</sub>`)
  return parts.join('\n')
}

// ─── Slug helpers ─────────────────────────────────────────────────────────────
function toSlug(s: string) {
  return s.toLowerCase().trim()
    .replace(/[^\w\s-]/g,'').replace(/[\s_]+/g,'-').replace(/^-+|-+$/g,'')
}
function randSuffix() {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  return Array.from({length:4}, () => chars[Math.floor(Math.random()*26)]).join('')
}

// ─── URL Generator data ────────────────────────────────────────────────────────
type BrandGroup = 'rr' | 'lr' | 'jag'

// Detect brand group from nameplate string
function detectBrandGroup(nameplate: string): BrandGroup {
  const n = (nameplate || '').toLowerCase()
  if (n.includes('range rover') || n.includes('evoque') || n.includes('velar')) return 'rr'
  if (n.includes('defender') || n.includes('discovery') || n.includes('freelander')) return 'lr'
  return 'jag'
}

// Nameplate slug for URL
function nameplateSlug(nameplate: string): string {
  const n = (nameplate || '').toLowerCase().trim()
  if (n.includes('range rover sport')) return 'range-rover-sport'
  if (n.includes('range rover evoque') || n.includes('evoque')) return 'range-rover-evoque'
  if (n.includes('range rover velar') || n.includes('velar')) return 'range-rover-velar'
  if (n.includes('range rover')) return 'range-rover'
  if (n.includes('discovery sport')) return 'discovery-sport'
  if (n.includes('discovery')) return 'discovery'
  if (n.includes('defender')) return 'defender'
  return toSlug(nameplate)
}

// Path segment for LR (Defender/Discovery go in the path for some URL types)
function lrPathSegment(nameplate: string): string {
  const s = nameplateSlug(nameplate)
  if (['defender','discovery','discovery-sport'].includes(s)) return s
  return ''
}

interface MarketEntry { name: string; langs: { code: string; label: string }[] }

const RR_MARKETS: MarketEntry[] = [
  { name:'UAE',         langs:[{code:'en-ae',label:'EN'},{code:'ar-ae',label:'AR'}] },
  { name:'Saudi Arabia',langs:[{code:'en-sa',label:'EN'},{code:'ar-sa',label:'AR'}] },
  { name:'Qatar',       langs:[{code:'en-qa',label:'EN'},{code:'ar-qa',label:'AR'}] },
  { name:'Oman',        langs:[{code:'en-om',label:'EN'},{code:'ar-om',label:'AR'}] },
  { name:'Bahrain',     langs:[{code:'en-bh',label:'EN'},{code:'ar-bh',label:'AR'}] },
  { name:'Kuwait',      langs:[{code:'en-kw',label:'EN'},{code:'ar-kw',label:'AR'}] },
  { name:'Jordan',      langs:[{code:'en-jo',label:'EN'},{code:'ar-jo',label:'AR'}] },
  { name:'Egypt',       langs:[{code:'en-eg',label:'EN'},{code:'ar-eg',label:'AR'}] },
  { name:'Palestine',   langs:[{code:'en-ps',label:'EN'},{code:'ar-ps',label:'AR'}] },
  { name:'Iraq',        langs:[{code:'en-iq',label:'EN'},{code:'ar-iq',label:'AR'},{code:'ku-iq',label:'KU'}] },
  { name:'Morocco',     langs:[{code:'en-ma',label:'EN'},{code:'ar-ma',label:'AR'},{code:'fr-ma',label:'FR'}] },
  { name:'Lebanon',     langs:[{code:'en-lb',label:'EN'},{code:'ar-lb',label:'AR'},{code:'fr-lb',label:'FR'}] },
  { name:'Tunisia',     langs:[{code:'en-tn',label:'EN'},{code:'ar-tn',label:'AR'},{code:'fr-tn',label:'FR'}] },
  { name:'Algeria',     langs:[{code:'en-dz',label:'EN'},{code:'ar-dz',label:'AR'},{code:'fr-dz',label:'FR'}] },
  { name:'Azerbaijan',  langs:[{code:'en-az',label:'EN'},{code:'az-az',label:'AZ'}] },
  { name:'Georgia',     langs:[{code:'en-ge',label:'EN'},{code:'ge-ge',label:'GE'}] },
  { name:'Kazakhstan',  langs:[{code:'en-kz',label:'EN'},{code:'ru-kz',label:'RU'},{code:'kz-kz',label:'KZ'}] },
  { name:'Armenia',     langs:[{code:'en-am',label:'EN'},{code:'ru-am',label:'RU'},{code:'am-am',label:'AM'}] },
]

const LR_DOMAINS: Record<string, string> = {
  'UAE':'landrover-uae.com','Saudi Arabia':'landrover-saudi.com','Qatar':'landrover-qatar.com',
  'Oman':'landrover-oman.com','Bahrain':'landroverbahrain.com','Kuwait':'landroverkuwait.com',
  'Jordan':'landrover-jordan.com','Egypt':'landrover-egypt.com','Palestine':'landrover-palestine.com',
  'Iraq':'landrover-iraq.com','Morocco':'landrover-maroc.com','Lebanon':'landrover-lebanon.com',
  'Tunisia':'landrover-tunisie.com','Algeria':'landrover-algerie.com',
  'Azerbaijan':'landrover-azerbaijan.com','Georgia':'landrover-georgia.com',
  'Kazakhstan':'landrover-kazakhstan.com','Armenia':'landrover-armenia.com',
}
const JAG_DOMAINS: Record<string, string> = {
  'UAE':'jaguar-uae.com','Saudi Arabia':'jaguar-saudi.com','Qatar':'jaguar-qatar.com',
  'Oman':'jaguar-oman.com','Bahrain':'jaguar-bahrain.com','Kuwait':'jaguar-kuwait.com',
  'Jordan':'jaguar-jordan.com','Egypt':'jaguar-egypt.com','Palestine':'jaguar-palestine.com',
  'Iraq':'jaguar-iraq.com','Morocco':'jaguar-maroc.com','Lebanon':'jaguar-lebanon.com',
  'Tunisia':'jaguar-tunisie.com','Algeria':'jaguar-algerie.com',
  'Azerbaijan':'jaguar-azerbaijan.com','Georgia':'jaguar-georgia.com',
  'Kazakhstan':'jaguar-kazakhstan.com','Armenia':'jaguar-armenia.com',
}

const LR_LANG_CODES: Record<string, string[]> = {
  'UAE':['en','ar'],'Saudi Arabia':['en','ar'],'Qatar':['en','ar'],'Oman':['en','ar'],
  'Bahrain':['en','ar'],'Kuwait':['en','ar'],'Jordan':['en','ar'],'Egypt':['en','ar'],
  'Palestine':['en','ar'],'Iraq':['en','ar','ku'],'Morocco':['en','ar','fr'],
  'Lebanon':['en','ar','fr'],'Tunisia':['en','ar','fr'],'Algeria':['en','ar','fr'],
  'Azerbaijan':['en','az'],'Georgia':['en','ge'],'Kazakhstan':['en','kz','ru'],'Armenia':['en','am','ru'],
}

function buildUrl(bg: BrandGroup, market: string, langCode: string, category: string, np: string, anchor1: string, anchor2: string): string {
  if (!anchor1) return ''
  const hashStr = anchor2 ? `#${anchor2}` : ''
  const catPath = category === 'new' ? 'new-vehicles'
    : category === 'used' ? 'approved-used'
    : category === 'owners' ? 'owners'
    : 'collections'

  if (bg === 'rr') {
    const base = `https://www.rangerover.com/${langCode}/`
    return `${base}offers-and-finance/${catPath}?suboffer=${anchor1}${hashStr}`
  }
  if (bg === 'lr') {
    const domain = LR_DOMAINS[market] || 'landrover.com'
    const base = `https://www.${domain}/${langCode}/`
    const pathSeg = lrPathSegment(np)
    const namePath = pathSeg ? `${pathSeg}/` : ''
    return `${base}${namePath}offers-and-finance/${catPath}?suboffer=${anchor1}${hashStr}`
  }
  if (bg === 'jag') {
    const domain = JAG_DOMAINS[market] || 'jaguar.com'
    const base = `https://www.${domain}/${langCode}/`
    return `${base}offers-and-finance/${catPath}?suboffer=${anchor1}${hashStr}`
  }
  return ''
}

// ─── Auto-detection helpers for URL Generator ────────────────────────────────
function detectCategoryFromOfferType(offerType: string): string {
  const t = offerType.toLowerCase()
  if (/^1\)/.test(t.trim()) || t.includes('new vehicle')) return 'new'
  if (/^2\)/.test(t.trim()) || t.includes('approved used')) return 'used'
  if (/^3\)/.test(t.trim()) || t.includes('owner')) return 'owners'
  if (/^4\)/.test(t.trim()) || t.includes('collection')) return 'collections'
  // Secondary keywords
  if (t.includes('aftersales') || t.includes('oil change') || t.includes('accessories') || t.includes('mobility') || t.includes('extended warranty') || t.includes('recall') || t.includes('connected service')) return 'owners'
  if (t.includes('buyback') || t.includes('trade-in') || t.includes('trade in')) return 'used'
  return 'new'
}

function detectSubcategoryFromOfferType(offerType: string): string {
  const t = offerType.toLowerCase()
  if (t.includes('aftersales') || t.includes('oil change') || t.includes('service') && !t.includes('connected') && !t.includes('financial')) return 'Aftersales'
  if (t.includes('connected service')) return 'Connected Services'
  if (t.includes('mobility')) return 'Mobility'
  if (t.includes('field action')) return 'Field Action Service'
  if (t.includes(' onp') || t.includes('owner notified')) return 'ONP'
  if (t.includes(' csp') || t.includes('customer satisfaction')) return 'CSP'
  if (t.includes('recall')) return 'Recall'
  if (t.includes('accessories')) return 'Accessories'
  if (t.includes('extended warranty')) return 'Extended Warranty'
  if (t.includes('buyback')) return 'Buyback'
  if (t.includes('trade-in') || t.includes('trade in')) return 'Trade-in'
  if (t.includes('financial service')) return 'Financial Services'
  if (t.includes('no down payment') || t.includes('down payment')) return 'No Down Payment'
  if (t.includes('no interest')) return 'No Interest'
  if (t.includes('low interest')) return 'Low Interest'
  return ''
}

const MARKET_NAME_MAP: Record<string, string> = {
  'uae': 'UAE', 'dubai': 'UAE', 'abu dhabi': 'UAE',
  'saudi': 'Saudi Arabia', 'ksa': 'Saudi Arabia', 'saudi arabia': 'Saudi Arabia',
  'qatar': 'Qatar', 'oman': 'Oman', 'bahrain': 'Bahrain', 'kuwait': 'Kuwait',
  'jordan': 'Jordan', 'egypt': 'Egypt', 'palestine': 'Palestine', 'iraq': 'Iraq',
  'morocco': 'Morocco', 'maroc': 'Morocco', 'lebanon': 'Lebanon',
  'tunisia': 'Tunisia', 'tunisie': 'Tunisia', 'algeria': 'Algeria', 'algerie': 'Algeria',
  'azerbaijan': 'Azerbaijan', 'georgia': 'Georgia', 'kazakhstan': 'Kazakhstan', 'armenia': 'Armenia',
}

const DEFAULT_LANGS_FOR_MARKET: Record<string, string[]> = {
  'UAE':['en','ar'],'Saudi Arabia':['en','ar'],'Qatar':['en','ar'],'Oman':['en','ar'],
  'Bahrain':['en','ar'],'Kuwait':['en','ar'],'Jordan':['en','ar'],'Egypt':['en','ar'],
  'Palestine':['en','ar'],'Iraq':['en','ar'],'Morocco':['en','ar','fr'],
  'Lebanon':['en','ar','fr'],'Tunisia':['en','ar','fr'],'Algeria':['en','ar','fr'],
  'Azerbaijan':['en','az'],'Georgia':['en','ge'],'Kazakhstan':['en','kz','ru'],'Armenia':['en','am','ru'],
}

const RR_COUNTRY_CODES: Record<string, string> = {
  'UAE':'ae','Saudi Arabia':'sa','Qatar':'qa','Oman':'om','Bahrain':'bh','Kuwait':'kw',
  'Jordan':'jo','Egypt':'eg','Palestine':'ps','Iraq':'iq','Morocco':'ma','Lebanon':'lb',
  'Tunisia':'tn','Algeria':'dz','Azerbaijan':'az','Georgia':'ge','Kazakhstan':'kz','Armenia':'am',
}

function detectMarketsFromStr(marketStr: string, bg: BrandGroup): Record<string, string[]> {
  if (!marketStr) return {}
  const key = marketStr.toLowerCase().trim()
  const found = MARKET_NAME_MAP[key]
  if (!found) return {}
  const baseLangs = DEFAULT_LANGS_FOR_MARKET[found] || ['en','ar']
  if (bg === 'rr') {
    const cc = RR_COUNTRY_CODES[found]
    if (!cc) return {}
    return { [found]: baseLangs.map(l => `${l}-${cc}`) }
  }
  return { [found]: baseLangs }
}

function UrlGenerator({ offer }: { offer: Offer }) {
  const bg = detectBrandGroup(offer.nameplate || offer.langs.EN.h1)

  // Auto-detect from parsed DOCX data
  const initCat = detectCategoryFromOfferType(offer.offerType)

  const [selBg, setSelBg] = useState<BrandGroup>(bg)
  const [category, setCategory] = useState(initCat)
  const [selMarkets, setSelMarkets] = useState<Record<string, string[]>>(() => detectMarketsFromStr(offer.market, bg))
  const [copied, setCopied] = useState(false)

  // These come directly from the parsed offer — anchor1 = Headline1-slug + 4 random letters, anchor2 = URL field
  const anchor1 = offer.anchor1
  const anchor2 = offer.urlSlug || offer.anchor2
  const np = offer.nameplate || offer.langs.EN.h1

  const markets = selBg === 'rr' ? RR_MARKETS : RR_MARKETS.map(m => ({
    ...m,
    langs: (LR_LANG_CODES[m.name] || ['en','ar']).map(lc => ({ code: lc, label: lc.toUpperCase() }))
  }))

  function toggleLang(marketName: string, langCode: string) {
    setSelMarkets(prev => {
      const cur = prev[marketName] || []
      const has = cur.includes(langCode)
      const next = has ? cur.filter(l => l !== langCode) : [...cur, langCode]
      return { ...prev, [marketName]: next }
    })
  }

  function selectAll() {
    const all: Record<string, string[]> = {}
    markets.forEach(m => { all[m.name] = m.langs.map(l => l.code) })
    setSelMarkets(all)
  }

  // Re-detect markets when brand group changes
  const handleBgChange = (newBg: BrandGroup) => {
    setSelBg(newBg)
    const reDetected = detectMarketsFromStr(offer.market, newBg)
    if (Object.keys(reDetected).length > 0) setSelMarkets(reDetected)
  }

  const generatedUrls: { market: string; lang: string; url: string }[] = []
  markets.forEach(m => {
    const langs = selMarkets[m.name] || []
    langs.forEach(lc => {
      const url = buildUrl(selBg, m.name, lc, category, np, anchor1, anchor2)
      if (url) generatedUrls.push({ market: m.name, lang: lc.toUpperCase(), url })
    })
  })

  function copyAll() {
    navigator.clipboard.writeText(generatedUrls.map(u => u.url).join('\n'))
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }

  const iS: React.CSSProperties = { background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:"'Inter',sans-serif", fontSize:'0.68rem', padding:'4px 8px', outline:'none' }

  return (
    <div style={{ marginTop:16, padding:14, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8 }}>
      <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        URL Generator
      </div>

      {/* Config row */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10, alignItems:'flex-end' }}>
        <div>
          <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:3 }}>Brand Group</div>
          <select style={iS} value={selBg} onChange={e => handleBgChange(e.target.value as BrandGroup)}>
            <option value="rr">Range Rover (rangerover.com)</option>
            <option value="lr">Land Rover (landrover-*.com)</option>
            <option value="jag">Jaguar (jaguar-*.com)</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:3 }}>Category</div>
          <select style={iS} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="new">1) New Vehicles</option>
            <option value="used">2) Approved Used</option>
            <option value="owners">3) Owners</option>
            <option value="collections">4) Collections</option>
          </select>
        </div>
        {/* Read-only anchors sourced from the Word file */}
        <div style={{ fontSize:'0.58rem', fontFamily:'monospace', background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:4, padding:'4px 8px', color:'var(--accent)', whiteSpace:'nowrap' }}>
          suboffer: {anchor1 || '—'}
        </div>
        <div style={{ fontSize:'0.58rem', fontFamily:'monospace', background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:4, padding:'4px 8px', color:'var(--text-2)', whiteSpace:'nowrap' }}>
          #{anchor2 || '—'}
        </div>
      </div>

      {/* Market / Language selector */}
      <div style={{ border:'1px solid var(--border)', borderRadius:6, overflow:'hidden', marginBottom:10 }}>
        <div style={{ padding:'6px 10px', background:'var(--surface)', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid var(--border)' }}>
          <span style={{ fontSize:'0.58rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--text-3)', flex:1 }}>Select Markets & Languages</span>
          <button onClick={selectAll} style={{ ...iS, padding:'2px 8px', cursor:'pointer', fontSize:'0.58rem' }}>Select All</button>
          <button onClick={() => setSelMarkets({})} style={{ ...iS, padding:'2px 8px', cursor:'pointer', fontSize:'0.58rem' }}>Clear</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:0 }}>
          {markets.map(m => (
            <div key={m.name} style={{ padding:'6px 10px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:'0.68rem', color:'var(--text)', flex:1 }}>{m.name}</span>
              <div style={{ display:'flex', gap:3 }}>
                {m.langs.map(l => {
                  const sel = (selMarkets[m.name] || []).includes(l.code)
                  return (
                    <button key={l.code} onClick={() => toggleLang(m.name, l.code)}
                      style={{ fontSize:'0.58rem', fontWeight:700, padding:'2px 6px', borderRadius:3, border:'1px solid', cursor:'pointer', transition:'all .1s', fontFamily:'inherit',
                        background: sel ? 'var(--accent-dim)' : 'transparent',
                        color: sel ? 'var(--accent)' : 'var(--text-3)',
                        borderColor: sel ? 'var(--accent-brd)' : 'var(--border)' }}>
                      {l.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generated URLs */}
      {generatedUrls.length > 0 && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ fontSize:'0.58rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--text-3)', flex:1 }}>{generatedUrls.length} URLs generated</span>
            <button onClick={copyAll} style={{ fontSize:'0.62rem', fontWeight:600, padding:'4px 12px', borderRadius:5, border:'1px solid var(--accent-brd)', background:'var(--accent-dim)', color:'var(--accent)', cursor:'pointer', fontFamily:'inherit' }}>
              {copied ? '✓ Copied!' : '⎘ Copy All'}
            </button>
          </div>
          <div style={{ background:'var(--surface-3)', borderRadius:6, padding:10, maxHeight:200, overflowY:'auto' }}>
            {generatedUrls.map((u, i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:4 }}>
                <span style={{ fontSize:'0.56rem', fontWeight:700, minWidth:40, color:'var(--text-3)', paddingTop:1 }}>{u.market.slice(0,3).toUpperCase()}/{u.lang}</span>
                <span style={{ fontSize:'0.62rem', fontFamily:'monospace', color:'var(--text-2)', wordBreak:'break-all', flex:1, lineHeight:1.4 }}>{u.url}</span>
                <button onClick={() => navigator.clipboard.writeText(u.url)}
                  style={{ fontSize:10, padding:'1px 5px', borderRadius:3, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text-3)', cursor:'pointer', flexShrink:0 }}>⎘</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {generatedUrls.length === 0 && (
        <div style={{ fontSize:'0.65rem', color:'var(--text-3)', textAlign:'center', padding:'10px 0' }}>Select markets above to generate URLs</div>
      )}
    </div>
  )
}

// ─── Offer types ──────────────────────────────────────────────────────────────
interface LangData {
  h1: string; h2: string; h3: string; h3b: string; h4: string; h5: string
  sh1: string; sh2: string; sh3: string; cta: string
  desc: string; feed: string; feed2: string
}
interface Offer {
  id: string
  market: string; brand: string; nameplate: string; modelYear: string
  offerType: string; displayedOn: string; urlSlug: string
  anchor1: string; anchor2: string; subcategory: string; sequence: string; feedTheme: string
  startDate: string; endDate: string; startId: string
  langs: { EN: LangData; AR: LangData; FR: LangData }
  hasAR: boolean; hasFR: boolean
  collapsed: boolean
}

function emptyLang(): LangData { return { h1:'',h2:'',h3:'',h3b:'',h4:'',h5:'',sh1:'',sh2:'',sh3:'',cta:'',desc:'',feed:'',feed2:'' } }

// ─── DOCX parser ─────────────────────────────────────────────────────────────
async function parseDocxMulti(buffer: ArrayBuffer): Promise<Offer[]> {
  const zip = await JSZip.loadAsync(buffer)
  const xmlStr = await zip.file('word/document.xml')!.async('string')
  const xmlDoc = new DOMParser().parseFromString(xmlStr, 'application/xml')
  const body = xmlDoc.documentElement

  const blocks: Array<{type:'p'|'tbl'; el: Element}> = []
  for (const child of Array.from(body.children)) {
    if (child.localName === 'body') {
      for (const b of Array.from(child.children)) {
        if (b.localName === 'p') blocks.push({type:'p', el:b})
        else if (b.localName === 'tbl') blocks.push({type:'tbl', el:b})
      }
    } else if (child.localName === 'p') blocks.push({type:'p', el:child})
    else if (child.localName === 'tbl') blocks.push({type:'tbl', el:child})
  }

  const mainTables: Array<{idx: number; el: Element; colEN: number; colAR: number; colFR: number}> = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.type !== 'tbl') continue
    const rows = wq(b.el, 'tr')
    if (!rows.length) continue
    const hcells = wq(rows[0], 'tc')
    const hdrs = hcells.map(tc => cellFirstLine(tc).toLowerCase())
    const ei = hdrs.findIndex(h => h.includes('english'))
    const ai = hdrs.findIndex(h => h.includes('arabic') || /[\u0600-\u06ff]/.test(h))
    const fi = hdrs.findIndex(h => h.includes('french') || h.includes('fran'))
    if (ei > 0 && ai > 0) mainTables.push({idx:i, el:b.el, colEN:ei, colAR:ai, colFR: fi>=0?fi:-1})
  }

  const offers: Offer[] = []

  for (const mt of mainTables) {
    // Strip invisible Unicode that .trim() misses (zero-width spaces etc)
    const cleanTxt = (raw: string) =>
      raw.replace(/[\u200b\u200c\u200d\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').trim()

    // Collect paragraph texts before this table — scan up to 120 blocks back
    // (Word docs may have many empty <w:p> elements, so 40 was too small)
    const prevTexts: Array<{txt: string; lower: string}> = []
    for (let bi = mt.idx - 1; bi >= 0 && bi >= mt.idx - 120; bi--) {
      if (blocks[bi].type !== 'p') continue
      const raw = wq(blocks[bi].el, 't').map(t => t.textContent).join('')
      const txt = cleanTxt(raw)
      if (txt) prevTexts.unshift({ txt, lower: txt.toLowerCase() })
    }

    let market='', brand='', nameplate='', modelYear='', offerType='', displayedOn='', urlSlug=''
    const offerTypeLines: string[] = []
    let inOfferType = false

    // ── URL slug: scan ALL prevTexts for the first #slug pattern ─────────────
    // Handles all Word layouts: separate paragraph, same paragraph, soft-return, etc.
    for (const { txt } of prevTexts) {
      const m = txt.match(/#([\w][\w-]{2,})/)
      if (m) { urlSlug = m[1]; break }
    }

    for (const { txt, lower } of prevTexts) {
      if (!market && lower.startsWith('market:')) { market = txt.replace(/^market:\s*/i,'').trim(); inOfferType = false; continue }
      if (!brand && lower.startsWith('brand:')) { brand = txt.replace(/^brand:\s*/i,'').trim(); inOfferType = false; continue }
      if (!modelYear && lower.startsWith('model year:')) { modelYear = txt.replace(/^model year:\s*/i,'').trim(); inOfferType = false; continue }
      if (!displayedOn && lower.startsWith('displayed on:')) { displayedOn = txt.replace(/^displayed on:\s*/i,'').trim(); inOfferType = false; continue }
      if (lower.startsWith('url:')) { inOfferType = false; continue }

      if (lower.includes('offer type')) {
        inOfferType = true
        const inline = txt.replace(/offer\s*type\s*:?\s*/i,'').trim()
        if (inline) offerTypeLines.push(inline)
        continue
      }
      if (inOfferType) {
        if (/^(displayed on|model year|url|market:|brand:|landing page|reffine offer)/i.test(txt)) {
          inOfferType = false
        } else if (txt.length < 200) {
          offerTypeLines.push(txt)
        }
      }
      if (!nameplate && /^(range rover|defender|discovery|jaguar)/i.test(txt) && txt.length < 60 && !lower.includes(':')) {
        nameplate = txt.trim()
      }
    }
    offerType = offerTypeLines.join('\n')

    if (!nameplate) {
      const rows2 = wq(mt.el, 'tr')
      for (const row of rows2.slice(1)) {
        const cells = wq(row, 'tc')
        if (!cells.length) continue
        const label = cellAllText(cells[0]).toLowerCase()
        if (/headline\s*1\b(?!\s*\()/.test(label) && cells[mt.colEN]) {
          nameplate = cellFirstLine(cells[mt.colEN]).trim()
          break
        }
      }
    }

    const ROW_DEFS: [keyof LangData, RegExp][] = [
      ['h1',  /headline\s*1\b(?!\s*\()/i], ['h2',  /headline\s*2\b(?!\s*\()/i],
      ['h3',  /headline\s*3a\b/i],         ['h3b', /headline\s*3b\b/i],
      ['h4',  /headline\s*4\b(?!\s*\()/i], ['h5',  /headline\s*5\b(?!\s*\()/i],
      ['cta', /^cta$/i],
      ['sh1', /headline\s*1\s*\(drop/i],   ['sh2', /headline\s*2\s*\(drop/i],
      ['sh3', /headline\s*3\s*\(drop/i],   ['desc',/offer\s*description/i]
    ]
    const rowCells: Partial<Record<keyof LangData, Element[]>> = {}
    const rows = wq(mt.el, 'tr')
    for (const row of rows.slice(1)) {
      const cells = wq(row, 'tc')
      if (!cells.length) continue
      const label = cellAllText(cells[0]).toLowerCase().replace(/\s+/g,' ').trim()
      for (const [key, pat] of ROW_DEFS) { if (!rowCells[key] && pat.test(label)) { rowCells[key] = cells; break } }
    }

    function getField(key: keyof LangData, col: number): string {
      const cells = rowCells[key]; if (!cells || col < 0) return ''
      return (cells[col]) ? cellFirstLine(cells[col]).trim() : ''
    }
    function getDesc(col: number): string {
      const cells = rowCells['desc']; if (!cells || col < 0) return ''
      return cells[col] ? cellAllText(cells[col]) : ''
    }

    const buildLang = (col: number): LangData => {
      const h3a = getField('h3', col)
      const h3b = getField('h3b', col)
      // Combine 3a + 3b with newline when both present
      const h3 = h3a && h3b ? `${h3a}\n${h3b}` : (h3a || h3b)
      const h2 = getField('h2', col)
      const raw = getDesc(col)
      return {
        h1: getField('h1', col), h2, h3, h3b: '',
        // Word's Headline 5 → App's Headline 4
        h4: getField('h5', col), h5: '',
        sh1: getField('sh1', col), sh2: getField('sh2', col), sh3: getField('sh3', col),
        cta: getField('cta', col), desc: textToHtml(raw),
        feed: h3 || h2, feed2: ''
      }
    }

    const enLang = buildLang(mt.colEN)
    const arLang = mt.colAR >= 0 ? buildLang(mt.colAR) : emptyLang()
    const frLang = mt.colFR >= 0 ? buildLang(mt.colFR) : emptyLang()

    // Anchor 1: slug from Headline 1 (table cell) + 4 random lowercase letters
    // Anchor 2: the URL field from the Word doc (e.g. #exclusive-service → exclusive-service)
    const h1slug = toSlug(enLang.h1)  // use Headline 1 from table only
    const anchor1 = h1slug ? `${h1slug}-${randSuffix()}` : ''
    const anchor2 = urlSlug  // comes from URL: field in Word

    offers.push({
      id: `offer_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      market, brand, nameplate: nameplate || enLang.h1, modelYear, offerType, displayedOn, urlSlug,
      anchor1, anchor2,
      subcategory: offerType.replace(/^\d+\)\s*/,'').trim(),
      sequence: String(offers.length * 10),
      feedTheme: 'light',
      startDate: '', endDate: '', startId: '',
      langs: { EN: enLang, AR: arLang, FR: frLang },
      hasAR: !!(arLang.h1 || arLang.h3),
      hasFR: !!(frLang.h1 || frLang.h3),
      collapsed: false
    })
  }

  return offers
}

// ─── CSV export ───────────────────────────────────────────────────────────────
const CSV_COLS = ['Id','Title','Created at','Updated at','Start date','End date','Headline 1','Headline 2','Headline 3','Headline 4','Headline 5','Subheadline 1','Subheadline 2','Subheadline 3','Description','Anchor 1','Anchor 2','Cta label','Subcategory','Vins','Sequence','Feed headline','Feed headline 2','Feed theme']

function csvField(v: unknown, forceQuote = false): string {
  const s = String(v ?? '')
  return (forceQuote || /[,\n\r"]/.test(s)) ? `"${s.replace(/"/g,'""')}"` : s
}

function exportAllCSV(offers: Offer[], filename: string) {
  const now = (() => { const d = new Date(); const p = (n:number) => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} +0100` })()
  const today = new Date().toISOString().slice(0,10)
  const lines: string[] = [CSV_COLS.map(c=>csvField(c)).join(',')]
  let globalId = 1000

  for (const offer of offers) {
    const langList: Array<{lang: 'EN'|'AR'|'FR', data: LangData}> = [
      {lang:'EN', data: offer.langs.EN},
      ...(offer.hasAR ? [{lang:'AR' as const, data: offer.langs.AR}] : []),
      ...(offer.hasFR ? [{lang:'FR' as const, data: offer.langs.FR}] : []),
    ]
    for (const {lang, data} of langList) {
      const id = offer.startId ? parseInt(offer.startId) + langList.findIndex(l=>l.lang===lang) : globalId++
      const title = `${(data.h1||offer.nameplate).trim()} ${lang}`
      const row = [
        id, title, now, now, offer.startDate, offer.endDate,
        data.h1, data.h2, data.h3||data.h3b, data.h4, data.h5,
        data.sh1, data.sh2, data.sh3,
        data.desc,
        offer.anchor1, offer.urlSlug || offer.anchor2, data.cta,
        '', '', offer.sequence,
        data.feed, data.feed2, offer.feedTheme
      ]
      lines.push(row.map((v,ci) => csvField(v, ci===14)).join(','))
    }
  }

  const csv = lines.join('\r\n')
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'})
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = `${filename}-${today}.csv`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}

// ─── Live Offer Preview ───────────────────────────────────────────────────────
function LiveOfferPreview({ d, nameplate, isRTL }: { d: LangData; nameplate: string; isRTL?: boolean }) {
  const h5lower = (d.h5 || '').toLowerCase()
  const isDisclaimer = h5lower.includes('vat') || h5lower.includes('tax') || h5lower.includes('terms') || h5lower.includes('inclusive')

  return (
    <div style={{
      fontFamily: "'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif",
      background: '#fff', border: '1px solid #e5e5e5', borderRadius: 6,
      overflow: 'hidden', minHeight: 200, maxHeight: 450, overflowY: 'auto'
    }}>
      {/* Scoped CSS for bullet points matching live JLR site */}
      <style>{`
        .jlr-offer-preview ul { list-style-type: disc; padding-left: 22px; margin: 6px 0 10px; }
        .jlr-offer-preview ul li { margin-bottom: 4px; font-size: 12.5px; line-height: 1.6; color: #333; }
        .jlr-offer-preview p { margin: 0 0 10px; }
        .jlr-offer-preview b, .jlr-offer-preview strong { font-weight: 700; }
        .jlr-offer-preview sub { font-size: 10.5px; color: #888; display: block; margin-top: 6px; line-height: 1.5; font-style: italic; }
      `}</style>
      {/* Nameplate header */}
      {(d.h1 || nameplate) && (
        <div style={{ textAlign: 'center', paddingTop: 28, paddingBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#333', fontFamily: 'inherit' }}>
            {d.h1 || nameplate}
          </div>
        </div>
      )}
      {/* Offer title */}
      {d.h2 && (
        <div style={{ textAlign: 'center', padding: '4px 20px 16px' }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#111', lineHeight: 1.25, fontFamily: 'inherit' }}>
            {d.h2}
          </div>
        </div>
      )}
      {/* Priority message (h3) */}
      {d.h3 && (
        <div style={{ textAlign: 'center', padding: '0 20px 12px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#444', fontFamily: 'inherit' }}>{d.h3}</div>
          {d.h3b && <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{d.h3b}</div>}
        </div>
      )}
      {/* Divider */}
      {(d.h1 || d.h2) && <div style={{ height: 1, background: '#e5e5e5', margin: '0 20px 16px' }} />}
      {/* Description */}
      {d.desc && (
        <div className="jlr-offer-preview" dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '0 20px 16px', fontSize: 12.5, lineHeight: 1.7, color: '#333', fontFamily: 'inherit' }}
          dangerouslySetInnerHTML={{ __html: d.desc }} />
      )}
      {/* Headline 4 */}
      {d.h4 && (
        <div style={{ padding: '0 20px 10px', fontSize: 12, color: '#555', fontFamily: 'inherit' }}>{d.h4}</div>
      )}
      {/* H5 / Terms */}
      {d.h5 && (
        <div style={{ padding: '0 20px 16px', fontSize: isDisclaimer ? 10.5 : 12, color: isDisclaimer ? '#888' : '#555', fontStyle: isDisclaimer ? 'italic' : 'normal', fontFamily: 'inherit', lineHeight: 1.5 }}>
          {isDisclaimer ? `- ${d.h5}` : d.h5}
        </div>
      )}
      {/* CTA */}
      {d.cta && (
        <div style={{ padding: '4px 20px 24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: '#1a1a1a', color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '10px 24px', borderRadius: 2, fontFamily: 'inherit' }}>
            {d.cta}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── OfferCard ────────────────────────────────────────────────────────────────
function OfferCard({ offer, idx, onChange, onRemove }: {
  offer: Offer; idx: number
  onChange: (id: string, patch: Partial<Offer>) => void
  onRemove: (id: string) => void
}) {
  const [activeLang, setActiveLang] = useState<'EN'|'AR'|'FR'>('EN')
  const [showUrlGen, setShowUrlGen] = useState(false)

  function set(patch: Partial<Offer>) { onChange(offer.id, patch) }
  function setLang(lang: 'EN'|'AR'|'FR', patch: Partial<LangData>) {
    onChange(offer.id, { langs: { ...offer.langs, [lang]: { ...offer.langs[lang], ...patch } } })
  }

  const iS: React.CSSProperties = { width:'100%', background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:"'Inter',sans-serif", fontSize:'0.7rem', padding:'0.45rem 0.7rem', outline:'none' }

  const langs: Array<'EN'|'AR'|'FR'> = ['EN', ...(offer.hasAR?['AR' as const]:[]), ...(offer.hasFR?['FR' as const]:[])]


  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:14 }}>
      {/* Header */}
      <div style={{ background:'var(--surface-2)', padding:'10px 16px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}
        onClick={() => set({ collapsed: !offer.collapsed })}>
        <div style={{ width:22, height:22, borderRadius:6, background:'var(--accent-grad)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'0.6rem', fontWeight:700, color:'#fff' }}>{idx+1}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {offer.langs.EN.h1 || offer.nameplate || `Offer ${idx+1}`}
          </div>
          <div style={{ fontSize:'0.58rem', color:'var(--text-3)', display:'flex', gap:8, marginTop:1 }}>
            {offer.langs.EN.h2 && <span>📋 {offer.langs.EN.h2.slice(0,40)}{offer.langs.EN.h2.length>40?'…':''}</span>}
            {offer.langs.EN.h3 && <span>💰 {offer.langs.EN.h3}</span>}
          </div>
        </div>
        {langs.map(l => <span key={l} style={{ fontSize:'0.6rem', fontWeight:700, background: l==='EN'?'rgba(91,141,238,.15)':l==='AR'?'rgba(233,30,140,.15)':'rgba(34,197,94,.15)', border:`1px solid ${l==='EN'?'rgba(91,141,238,.35)':l==='AR'?'rgba(233,30,140,.35)':'rgba(34,197,94,.35)'}`, color: l==='EN'?'#5b8dee':l==='AR'?'var(--accent)':'var(--green)', borderRadius:4, padding:'2px 7px' }}>{l}</span>)}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.5" style={{ transform: offer.collapsed?'none':'rotate(180deg)', transition:'transform .2s', flexShrink:0 }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
        <button onClick={e=>{e.stopPropagation();if(confirm(`Remove "${offer.langs.EN.h1||'this offer'}\"?`))onRemove(offer.id)}}
          style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer', fontSize:16, lineHeight:1, flexShrink:0, padding:'2px 4px' }}>×</button>
      </div>

      {!offer.collapsed && (
        <div style={{ padding:'1.25rem' }}>
          {/* Anchor / ID / Date row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))', gap:8, marginBottom:14, paddingBottom:14, borderBottom:'1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:3 }}>Anchor 1 · Model Slug</div>
              <input style={{ ...iS, fontFamily:'monospace', fontSize:'0.68rem' }} value={offer.anchor1} onChange={e=>set({anchor1:e.target.value})} placeholder="range-rover-sport-wcdm" />
            </div>
            <div>
              <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:3 }}>Anchor 2 · Offer Slug</div>
              <input style={{ ...iS, fontFamily:'monospace', fontSize:'0.68rem' }} value={offer.anchor2} onChange={e=>set({anchor2:e.target.value})} placeholder="exclusive-offer" />
            </div>
            <div>
              <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:3 }}>Sequence</div>
              <input style={iS} value={offer.sequence} onChange={e=>set({sequence:e.target.value})} placeholder="0" />
            </div>
            <div>
              <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:3 }}>Starting ID</div>
              <input style={iS} value={offer.startId} onChange={e=>set({startId:e.target.value})} placeholder="1005" />
            </div>
            <div>
              <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:3 }}>Start Date</div>
              <input type="date" style={{ ...iS, colorScheme:'dark' }} value={offer.startDate} onChange={e=>set({startDate:e.target.value})} />
            </div>
            <div>
              <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:3 }}>End Date</div>
              <input type="date" style={{ ...iS, colorScheme:'dark' }} value={offer.endDate} onChange={e=>set({endDate:e.target.value})} />
            </div>
            <div>
              <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:3 }}>Feed Theme</div>
              <select style={iS} value={offer.feedTheme} onChange={e=>set({feedTheme:e.target.value})}>
                <option>light</option><option>dark</option>
              </select>
            </div>
          </div>

          {/* URL Generator toggle */}
          <button onClick={() => setShowUrlGen(p => !p)}
            style={{ marginBottom:14, display:'flex', alignItems:'center', gap:6, background:'none', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-2)', cursor:'pointer', fontFamily:'inherit', fontSize:'0.68rem', fontWeight:600, padding:'6px 12px', transition:'all .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--accent-brd)'; (e.currentTarget as HTMLElement).style.color='var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--border)'; (e.currentTarget as HTMLElement).style.color='var(--text-2)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            {showUrlGen ? 'Hide URL Generator' : '🔗 Generate URLs'}
          </button>
          {showUrlGen && <UrlGenerator offer={offer} />}

          {/* Lang tabs */}
          <div style={{ display:'flex', gap:4, marginBottom:14, marginTop:14 }}>
            {langs.map(l => (
              <button key={l} onClick={() => setActiveLang(l)}
                style={{ padding:'5px 16px', borderRadius:6, border:'1px solid', cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.06em', transition:'all .15s',
                  background: activeLang===l ? 'var(--accent-grad)' : 'var(--surface-2)',
                  borderColor: activeLang===l ? 'transparent' : 'var(--border)',
                  color: activeLang===l ? '#fff' : 'var(--text-2)' }}>{l}</button>
            ))}
            {!offer.hasAR && <button onClick={()=>set({hasAR:true})} style={{ padding:'5px 12px', borderRadius:6, border:'1px dashed var(--border)', cursor:'pointer', fontFamily:'inherit', fontSize:'0.68rem', color:'var(--text-3)', background:'none' }}>+ AR</button>}
            {!offer.hasFR && <button onClick={()=>set({hasFR:true})} style={{ padding:'5px 12px', borderRadius:6, border:'1px dashed var(--border)', cursor:'pointer', fontFamily:'inherit', fontSize:'0.68rem', color:'var(--text-3)', background:'none' }}>+ FR</button>}
          </div>

          {/* Fields for active language */}
          {langs.filter(l=>l===activeLang).map(lang => {
            const d = offer.langs[lang]
            const isRTL = lang === 'AR'
            return (
              <div key={lang} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {([
                      {f:'h1', l:'Headline 1 · Nameplate'},
                      {f:'h2', l:'Headline 2 · Offer Title'},
                      {f:'h3', l:'Headline 3a · Priority Msg (max 25)'},
                      {f:'h3b',l:'Headline 3b · Cont. (optional)'},
                      {f:'h4', l:'Headline 4 (optional)'},
                      {f:'h5', l:'Headline 5 · Terms (optional)'},
                      {f:'sh1',l:'Subheadline 1 (dropdown)'},
                      {f:'sh2',l:'Subheadline 2 (dropdown)'},
                      {f:'sh3',l:'Subheadline 3 (dropdown)'},
                      {f:'cta',l:'CTA Label'},
                      {f:'feed',l:'Feed Headline'},
                      {f:'feed2',l:'Feed Headline 2'},
                    ] as Array<{f: keyof LangData, l: string}>).map(({f,l}) => (
                      <div key={f}>
                        <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:3 }}>{l}</div>
                        <input style={{ ...iS, fontSize:'0.7rem' }} dir={isRTL?'rtl':'ltr'} value={d[f]||''} onChange={e=>setLang(lang,{[f]:e.target.value})} />
                        {f==='h3' && d[f] && <div style={{ fontSize:'0.5rem', color: d[f].length>25?'var(--red)':'var(--text-3)', marginTop:2 }}>{d[f].length}/25 chars</div>}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:3 }}>Description HTML</div>
                    <textarea dir={isRTL?'rtl':'ltr'} value={d.desc||''} onChange={e=>setLang(lang,{desc:e.target.value})}
                      style={{ width:'100%', background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:'monospace', fontSize:'0.65rem', padding:'0.5rem', outline:'none', resize:'vertical', minHeight:150 }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)' }} />Live Offer Preview
                  </div>
                  <LiveOfferPreview d={d} nameplate={offer.nameplate || offer.langs.EN.h1} isRTL={isRTL} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function OfferGeneratorPage() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [fileName, setFileName] = useState('')
  const [log, setLog] = useState('')
  const [logType, setLogType] = useState<'ok'|'err'|'info'>('info')
  const [globalStart, setGlobalStart] = useState('')
  const [globalEnd, setGlobalEnd] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function setL(m: string, t: 'ok'|'err'|'info') { setLog(m); setLogType(t) }

  async function handleFile(f: File) {
    if (!/\.docx$/i.test(f.name)) { setL('Please choose a .docx file.','err'); return }
    setFileName(f.name.replace(/\.docx$/i,''))
    setL('Parsing DOCX…','info')
    try {
      const buf = await f.arrayBuffer()
      const parsed = await parseDocxMulti(buf)
      if (!parsed.length) { setL('No offer tables found in this document.','err'); return }
      setOffers(parsed.map(o => ({ ...o, startDate: globalStart, endDate: globalEnd })))
      setL(`✓ Parsed ${parsed.length} offer${parsed.length>1?'s':''} — review each card below then Export CSV.`, 'ok')
    } catch (e: unknown) { setL('Error: '+((e as Error).message||String(e)), 'err') }
  }

  function updateOffer(id: string, patch: Partial<Offer>) {
    setOffers(prev => prev.map(o => o.id===id ? {...o,...patch} : o))
  }
  function removeOffer(id: string) { setOffers(prev => prev.filter(o => o.id!==id)) }
  function applyGlobalDates() {
    setOffers(prev => prev.map(o => ({ ...o, startDate: globalStart, endDate: globalEnd })))
  }
  function collapseAll() { setOffers(prev => prev.map(o => ({...o, collapsed:true}))) }
  function expandAll()   { setOffers(prev => prev.map(o => ({...o, collapsed:false}))) }

  const totalRows = offers.reduce((s,o)=>s+(o.hasAR?2:1)+(o.hasFR?1:0),0)

  return (
    <div style={{ paddingTop:60 }}>
      <TopNav />
      <div style={{ maxWidth:1300, margin:'0 auto', padding:'1.75rem 1.5rem 4rem' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-end', gap:16, paddingBottom:16, borderBottom:'1px solid var(--border)', marginBottom:16 }}>
          <div style={{ width:44, height:44, borderRadius:8, background:'var(--accent-dim)', border:'1px solid var(--accent-brd)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="1.5"><rect x="2" y="3" width="11" height="14" rx="1.5"/><path d="M5 7h5M5 10h5M5 13h3"/><path d="M14 6l4 4-4 4"/></svg>
          </div>
          <div>
            <h1 style={{ fontWeight:800, fontSize:20, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text)' }}>Offer Studio</h1>
            <p style={{ fontSize:11, color:'var(--text-3)', marginTop:3 }}>Parse Word templates · Multiple offers from one file · Export CMS-ready CSV</p>
          </div>
        </div>

        {/* Import bar */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'1rem 1.25rem', marginBottom:14 }}>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <label style={{ display:'inline-flex', alignItems:'center', gap:8, height:36, padding:'0 14px', borderRadius:7, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" opacity=".8"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/></svg>
              Choose .docx
              <input ref={fileRef} type="file" accept=".docx" style={{ display:'none' }} onChange={e => { const f=e.target.files?.[0]; if(f) handleFile(f) }} />
            </label>

            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ fontSize:'0.56rem', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--text-3)' }}>Global Dates:</div>
              <input type="date" value={globalStart} onChange={e=>setGlobalStart(e.target.value)} style={{ padding:'5px 8px', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:'inherit', fontSize:'0.68rem', outline:'none', colorScheme:'dark' }} />
              <span style={{ color:'var(--text-3)', fontSize:11 }}>→</span>
              <input type="date" value={globalEnd} onChange={e=>setGlobalEnd(e.target.value)} style={{ padding:'5px 8px', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:'inherit', fontSize:'0.68rem', outline:'none', colorScheme:'dark' }} />
              {offers.length>0 && <button onClick={applyGlobalDates} style={{ padding:'5px 10px', borderRadius:5, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text-2)', fontFamily:'inherit', fontSize:'0.65rem', cursor:'pointer' }}>Apply to all</button>}
            </div>

            <div style={{ flex:1 }} />

            {offers.length > 0 && <>
              <button onClick={collapseAll} style={{ padding:'5px 10px', borderRadius:5, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text-2)', fontFamily:'inherit', fontSize:'0.65rem', cursor:'pointer' }}>Collapse All</button>
              <button onClick={expandAll} style={{ padding:'5px 10px', borderRadius:5, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text-2)', fontFamily:'inherit', fontSize:'0.65rem', cursor:'pointer' }}>Expand All</button>
              <button className="btn-primary" onClick={() => exportAllCSV(offers, fileName||'offers')}>
                ↓ Export CSV ({totalRows} rows)
              </button>
            </>}
          </div>
          {log && <div style={{ fontSize:'0.65rem', marginTop:8, color: logType==='ok'?'var(--green)': logType==='err'?'var(--red)':'var(--orange)' }}>{log}</div>}
        </div>

        {/* Offer cards */}
        {offers.length === 0 && (
          <div style={{ textAlign:'center', padding:'3rem 1rem', color:'var(--text-3)', fontSize:'0.8rem' }}>
            <div style={{ fontSize:42, marginBottom:12 }}>📄</div>
            Import a .docx Word offer template to begin.<br/>
            <span style={{ fontSize:'0.68rem' }}>Multiple offers per file are automatically detected and shown as separate cards.</span>
          </div>
        )}
        {offers.map((offer, i) => (
          <OfferCard key={offer.id} offer={offer} idx={i} onChange={updateOffer} onRemove={removeOffer} />
        ))}
      </div>
      <Footer />
    </div>
  )
}
