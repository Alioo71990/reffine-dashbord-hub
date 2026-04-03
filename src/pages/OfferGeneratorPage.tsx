import { useState, useRef, useEffect } from 'react'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'
import { useAdmin, useTheme } from '../store'
import { fetchWithProxy, parseCSV } from '../lib/csvProxy'
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

function detectBrandGroup(nameplate: string): BrandGroup {
  const n = (nameplate || '').toLowerCase()
  if (n.includes('range rover') || n.includes('evoque') || n.includes('velar')) return 'rr'
  if (n.includes('defender') || n.includes('discovery') || n.includes('freelander')) return 'lr'
  return 'jag'
}

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

function detectCategoryFromOfferType(offerType: string): string {
  const t = offerType.toLowerCase()
  if (/^1\)/.test(t.trim()) || t.includes('new vehicle')) return 'new'
  if (/^2\)/.test(t.trim()) || t.includes('approved used')) return 'used'
  if (/^3\)/.test(t.trim()) || t.includes('owner')) return 'owners'
  if (/^4\)/.test(t.trim()) || t.includes('collection')) return 'collections'
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
  const initCat = detectCategoryFromOfferType(offer.offerType)

  const [selBg, setSelBg] = useState<BrandGroup>(bg)
  const [category, setCategory] = useState(initCat)
  const [selMarkets, setSelMarkets] = useState<Record<string, string[]>>(() => detectMarketsFromStr(offer.market, bg))
  const [copied, setCopied] = useState(false)

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
        <div style={{ fontSize:'0.58rem', fontFamily:'monospace', background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:4, padding:'4px 8px', color:'var(--accent)', whiteSpace:'nowrap' }}>
          suboffer: {anchor1 || '—'}
        </div>
        <div style={{ fontSize:'0.58rem', fontFamily:'monospace', background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:4, padding:'4px 8px', color:'var(--text-2)', whiteSpace:'nowrap' }}>
          #{anchor2 || '—'}
        </div>
      </div>

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
    const cleanTxt = (raw: string) =>
      raw.replace(/[\u200b\u200c\u200d\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').trim()

    const prevTexts: Array<{txt: string; lower: string}> = []
    for (let bi = mt.idx - 1; bi >= 0 && bi >= mt.idx - 120; bi--) {
      const block = blocks[bi]
      if (block.type === 'p') {
        const raw = wq(block.el, 't').map(t => t.textContent).join('')
        const txt = cleanTxt(raw)
        if (txt) prevTexts.unshift({ txt, lower: txt.toLowerCase() })
      } else if (block.type === 'tbl') {
        const tblParas = Array.from(block.el.getElementsByTagNameNS(WNS, 'p'))
        const tblTexts: Array<{txt: string; lower: string}> = []
        for (const p of tblParas) {
          const raw = Array.from(p.getElementsByTagNameNS(WNS, 't')).map(t => t.textContent).join('')
          const txt = cleanTxt(raw)
          if (txt) tblTexts.push({ txt, lower: txt.toLowerCase() })
        }
        prevTexts.unshift(...tblTexts)
      }
    }

    let market='', brand='', nameplate='', modelYear='', offerType='', displayedOn='', urlSlug='', startId='', subcategory='', sequence='', feedTheme=''
    for (const {lower} of prevTexts) {
      if (!market && /(?:market|country)\s*:/.test(lower)) market = lower.split(':')[1].trim().replace(/^[-\s]+|[-\s]+$/g,'')
      if (!brand && /(?:brand)\s*:/.test(lower)) brand = lower.split(':')[1].trim()
      if (!nameplate && /(?:nameplate|model)\s*:/.test(lower)) nameplate = lower.split(':')[1].trim()
      if (!modelYear && /(?:model\s*year|year)\s*:/.test(lower)) modelYear = lower.split(':')[1].trim()
      if (!offerType && /(?:offer\s*type|type)\s*:/.test(lower)) offerType = lower.split(':')[1].trim()
      if (!displayedOn && /(?:displayed\s*on|display)\s*:/.test(lower)) displayedOn = lower.split(':')[1].trim()
      if (!urlSlug && /(?:url\s*slug|slug)\s*:/.test(lower)) urlSlug = lower.split(':')[1].trim()
      if (!startId && /(?:start\s*id|id)\s*:/.test(lower)) startId = lower.split(':')[1].trim()
      if (!subcategory && /(?:sub\s*category|subcategory)\s*:/.test(lower)) subcategory = lower.split(':')[1].trim()
      if (!sequence && /(?:sequence|seq)\s*:/.test(lower)) sequence = lower.split(':')[1].trim()
      if (!feedTheme && /(?:feed\s*theme|theme)\s*:/.test(lower)) feedTheme = lower.split(':')[1].trim()
    }

    if (!market) {
      for (const {txt} of prevTexts) {
        if (!market && /(?:market|country)/i.test(txt) && txt.includes(':')) {
          market = txt.split(':')[1].trim().replace(/^[-\s]+|[-\s]+$/g,'')
        }
      }
    }

    const rows = wq(mt.el, 'tr').slice(1)
    const langs: { EN: LangData; AR: LangData; FR: LangData } = { EN: emptyLang(), AR: emptyLang(), FR: emptyLang() }
    let hasAR = false, hasFR = false

    for (const tr of rows) {
      const tcs = wq(tr, 'tc')
      if (tcs.length < 3) continue
      const enText = cellAllText(tcs[mt.colEN])
      const arText = mt.colAR >= 0 ? cellAllText(tcs[mt.colAR]) : ''
      const frText = mt.colFR >= 0 ? cellAllText(tcs[mt.colFR]) : ''

      const label = cellFirstLine(tcs[0]).toLowerCase().replace(/[:\s]+$/,'')
      const keyMap: Record<string, keyof LangData> = {
        'headline1':'h1','headline2':'h2','headline3':'h3','headline3b':'h3b',
        'headline4':'h4','headline5':'h5','subheadline1':'sh1','subheadline2':'sh2',
        'subheadline3':'sh3','cta':'cta','description':'desc','feed':'feed','feed2':'feed2',
      }
      const key = keyMap[label]
      if (key) {
        langs.EN[key] = enText
        if (arText) { langs.AR[key] = arText; hasAR = true }
        if (frText) { langs.FR[key] = frText; hasFR = true }
      }
    }

    if (!market && !offerType) continue

    const anchor1 = toSlug(langs.EN.h1 || offerType) + '-' + randSuffix()
    const anchor2 = urlSlug || ''

    offers.push({
      id: `offer_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      market, brand, nameplate, modelYear, offerType, displayedOn, urlSlug,
      anchor1, anchor2, subcategory, sequence, feedTheme,
      startDate: '', endDate: '', startId: '',
      langs, hasAR, hasFR, collapsed: false
    })
  }

  return offers
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportAllCSV(offers: Offer[], fileName: string) {
  const rows: string[][] = [['OFFER ID','Market','Brand','Nameplate','Model Year','Offer Type','Displayed On','URL Slug','Anchor 1','Anchor 2','Subcategory','Sequence','Feed Theme','Start Date','End Date','Start ID','Language','Headline1','Headline2','Headline3','Headline3b','Headline4','Headline5','SubHeadline1','SubHeadline2','SubHeadline3','CTA','Description','Feed','Feed2','HTML']]
  for (const o of offers) {
    const base = [o.id,o.market,o.brand,o.nameplate,o.modelYear,o.offerType,o.displayedOn,o.urlSlug,o.anchor1,o.anchor2,o.subcategory,o.sequence,o.feedTheme,o.startDate,o.endDate,o.startId]
    for (const lang of ['EN','AR','FR'] as const) {
      if (lang === 'AR' && !o.hasAR) continue
      if (lang === 'FR' && !o.hasFR) continue
      const l = o.langs[lang]
      rows.push([...base, lang, l.h1,l.h2,l.h3,l.h3b,l.h4,l.h5,l.sh1,l.sh2,l.sh3,l.cta,l.desc,l.feed,l.feed2, textToHtml(l.desc)])
    }
  }
  const csv = rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `${fileName}.csv`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 200)
}

// ─── Offer Card ───────────────────────────────────────────────────────────────
function OfferCard({ offer, idx, onChange, onRemove }: { offer: Offer; idx: number; onChange: (id: string, p: Partial<Offer>) => void; onRemove: (id: string) => void }) {
  const [editing, setEditing] = useState<Record<string, boolean>>({})
  const toggle = (k: string) => setEditing(e => ({...e, [k]: !e[k]}))
  const set = (k: string, v: string) => onChange(offer.id, { langs: { ...offer.langs, EN: { ...offer.langs.EN, [k]: v } } })

  const fields: { key: keyof LangData; label: string; multiline?: boolean }[] = [
    {key:'h1',label:'Headline 1'},{key:'h2',label:'Headline 2'},{key:'h3',label:'Headline 3'},
    {key:'h3b',label:'Headline 3b'},{key:'h4',label:'Headline 4'},{key:'h5',label:'Headline 5'},
    {key:'sh1',label:'Sub Headline 1'},{key:'sh2',label:'Sub Headline 2'},{key:'sh3',label:'Sub Headline 3'},
    {key:'cta',label:'CTA'},{key:'desc',label:'Description',multiline:true},
    {key:'feed',label:'Feed'},{key:'feed2',label:'Feed 2'},
  ]

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, marginBottom:12, overflow:'hidden' }}>
      {/* Card header */}
      <div style={{ padding:'0.75rem 1rem', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid var(--border)', background:'var(--surface-2)' }}>
        <button onClick={() => onChange(offer.id, { collapsed: !offer.collapsed })}
          style={{ background:'none', border:'none', color:'var(--text-2)', cursor:'pointer', padding:0, display:'flex', alignItems:'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: offer.collapsed ? 'rotate(-90deg)' : 'none', transition:'transform .2s' }}><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <span style={{ fontSize:'0.6rem', fontWeight:700, color:'var(--accent)', background:'var(--accent-dim)', border:'1px solid var(--accent-brd)', padding:'1px 6px', borderRadius:3 }}>#{idx+1}</span>
        <span style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text)', flex:1 }}>{offer.market} — {offer.offerType || 'Untitled'}</span>
        <span style={{ fontSize:'0.58rem', color:'var(--text-3)' }}>{offer.nameplate || ''} {offer.modelYear || ''}</span>
        <button onClick={() => onRemove(offer.id)} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:16, padding:'0 4px' }} title="Remove">×</button>
      </div>

      {!offer.collapsed && (
        <div style={{ padding:'1rem' }}>
          {/* Meta fields */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8, marginBottom:12 }}>
            {[
              {label:'Market',val:offer.market,key:'market' as const},
              {label:'Brand',val:offer.brand,key:'brand' as const},
              {label:'Nameplate',val:offer.nameplate,key:'nameplate' as const},
              {label:'Model Year',val:offer.modelYear,key:'modelYear' as const},
              {label:'Offer Type',val:offer.offerType,key:'offerType' as const},
              {label:'Displayed On',val:offer.displayedOn,key:'displayedOn' as const},
              {label:'URL Slug',val:offer.urlSlug,key:'urlSlug' as const},
              {label:'Start ID',val:offer.startId,key:'startId' as const},
              {label:'Subcategory',val:offer.subcategory,key:'subcategory' as const},
              {label:'Sequence',val:offer.sequence,key:'sequence' as const},
              {label:'Feed Theme',val:offer.feedTheme,key:'feedTheme' as const},
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:2 }}>{f.label}</div>
                <input value={f.val} onChange={e => onChange(offer.id, {[f.key]: e.target.value})}
                  style={{ width:'100%', background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:4, color:'var(--text)', fontFamily:'inherit', fontSize:'0.68rem', padding:'4px 6px', outline:'none' }} />
              </div>
            ))}
          </div>

          {/* Date fields */}
          <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center' }}>
            <div>
              <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:2 }}>Start Date</div>
              <input type="date" value={offer.startDate} onChange={e => onChange(offer.id, {startDate: e.target.value})}
                style={{ background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:4, color:'var(--text)', fontFamily:'inherit', fontSize:'0.68rem', padding:'4px 6px', outline:'none', colorScheme:'dark' }} />
            </div>
            <div>
              <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:2 }}>End Date</div>
              <input type="date" value={offer.endDate} onChange={e => onChange(offer.id, {endDate: e.target.value})}
                style={{ background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:4, color:'var(--text)', fontFamily:'inherit', fontSize:'0.68rem', padding:'4px 6px', outline:'none', colorScheme:'dark' }} />
            </div>
          </div>

          {/* Language fields */}
          {fields.map(f => (
            <div key={f.key} style={{ marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                <span style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--text-3)' }}>{f.label}</span>
                <button onClick={() => toggle(f.key)} style={{ fontSize:'0.55rem', color:'var(--accent)', background:'none', border:'none', cursor:'pointer', padding:0 }}>{editing[f.key] ? 'Hide' : 'Edit'}</button>
              </div>
              {editing[f.key] ? (
                f.multiline ? (
                  <textarea value={offer.langs.EN[f.key]} onChange={e => set(f.key, e.target.value)} rows={3}
                    style={{ width:'100%', background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:4, color:'var(--text)', fontFamily:'inherit', fontSize:'0.68rem', padding:'6px 8px', outline:'none', resize:'vertical' }} />
                ) : (
                  <input value={offer.langs.EN[f.key]} onChange={e => set(f.key, e.target.value)}
                    style={{ width:'100%', background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:4, color:'var(--text)', fontFamily:'inherit', fontSize:'0.68rem', padding:'4px 6px', outline:'none' }} />
                )
              ) : (
                <div style={{ fontSize:'0.72rem', color:'var(--text-2)', background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:4, padding:'6px 8px', minHeight:20, whiteSpace:'pre-wrap' }}>
                  {offer.langs.EN[f.key] || <span style={{color:'var(--text-3)'}}>—</span>}
                </div>
              )}
            </div>
          ))}

          {/* URL Generator */}
          <UrlGenerator offer={offer} />
        </div>
      )}
    </div>
  )
}

// ─── Offer Studio (original page content) ─────────────────────────────────────
function OfferStudio() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [fileName, setFileName] = useState('')
  const [globalStart, setGlobalStart] = useState('')
  const [globalEnd, setGlobalEnd] = useState('')
  const [log, setLog] = useState('')
  const [logType, setLogType] = useState<'ok'|'err'|'info'>('info')
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
    <div>
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
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Offers Status Tab
// ─────────────────────────────────────────────────────────────────────────────
interface OfferStatusRow {
  offerId: string; offerLink: string; startDate: string; endDate: string
  language: string; market: string; status: string; offerType: string
}

function statusBadgeStyle(s: string) {
  const k = (s || '').toUpperCase().trim()
  if (k === 'ACTIVE') return { bg:'rgba(34,197,94,.12)', brd:'rgba(34,197,94,.4)', color:'#22c55e' }
  if (k === 'INACTIVE') return { bg:'rgba(138,142,156,.1)', brd:'rgba(138,142,156,.3)', color:'#8a8e9c' }
  if (k === 'EXPIRED') return { bg:'rgba(232,66,74,.13)', brd:'rgba(232,66,74,.4)', color:'#e8424a' }
  return { bg:'rgba(138,142,156,.1)', brd:'rgba(138,142,156,.3)', color:'#8a8e9c' }
}

function typeBadgeStyle(t: string) {
  const k = (t || '').toLowerCase().trim()
  if (k.includes('new vehicle')) return { bg:'rgba(91,141,238,.13)', brd:'rgba(91,141,238,.4)', color:'#5b8dee' }
  if (k.includes('owner')) return { bg:'rgba(233,30,140,.12)', brd:'rgba(233,30,140,.35)', color:'var(--accent)' }
  if (k.includes('approved used')) return { bg:'rgba(232,151,58,.12)', brd:'rgba(232,151,58,.4)', color:'#e8973a' }
  if (k.includes('collection')) return { bg:'rgba(155,126,232,.13)', brd:'rgba(155,126,232,.4)', color:'#9b7ee8' }
  return { bg:'rgba(138,142,156,.1)', brd:'rgba(138,142,156,.3)', color:'#8a8e9c' }
}

function formatDate(d: string): string {
  if (!d) return '—'
  try {
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return d
    return dt.toISOString().slice(0, 10)
  } catch { return d }
}

function isPastToday(d: string): boolean {
  if (!d) return false
  try {
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return false
    const today = new Date(); today.setHours(0,0,0,0)
    return dt < today
  } catch { return false }
}

function OfferStatusTab() {
  const { config } = useAdmin()
  const [rows, setRows] = useState<OfferStatusRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fMarket, setFMarket] = useState('')
  const [fLang, setFLang] = useState('')
  const [fType, setFType] = useState('')
  const [sortCol, setSortCol] = useState<string>('')
  const [sortDir, setSortDir] = useState<1|-1>(1)
  const [visibleCount, setVisibleCount] = useState(50)

  const csvUrl = config.offersStatusUrl

  async function load() {
    if (!csvUrl) return
    setLoading(true); setError('')
    try {
      const raw = await fetchWithProxy(csvUrl)
      const parsed = parseCSV(raw)
      if (!parsed || parsed.length < 2) { setRows([]); return }

      // Find header row
      let headerIdx = 0
      for (let i = 0; i < Math.min(parsed.length, 5); i++) {
        if (parsed[i].join('').toLowerCase().includes('offer')) { headerIdx = i; break }
      }
      const hdrs = parsed[headerIdx].map(h => h.toLowerCase().trim())
      function colIdx(candidates: string[]) {
        for (const c of candidates) { const i = hdrs.indexOf(c); if (i !== -1) return i }
        for (const c of candidates) { for (let j = 0; j < hdrs.length; j++) { if (hdrs[j].includes(c)) return j } }
        return -1
      }
      const iOfferId  = colIdx(['offer id','offer'])
      const iLink     = colIdx(['links','link','offer link'])
      const iStart    = colIdx(['start date','start'])
      const iEnd      = colIdx(['end date','end'])
      const iLang     = colIdx(['language','lang'])
      const iMarket   = colIdx(['market'])
      const iStatus   = colIdx(['status'])
      const iType     = colIdx(['offer type','type'])

      const data = parsed.slice(headerIdx + 1).map(c => ({
        offerId: c[iOfferId] || '',
        offerLink: c[iLink] || '',
        startDate: formatDate(c[iStart] || ''),
        endDate: formatDate(c[iEnd] || ''),
        language: c[iLang] || '',
        market: c[iMarket] || '',
        status: (c[iStatus] || '').toUpperCase().trim(),
        offerType: c[iType] || '',
      })).filter(r => r.offerId.trim().length > 0)

      setRows(data)
    } catch (e) {
      setError('Failed to load. Check the CSV URL in Admin.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [csvUrl])

  // Filtered + sorted
  const filtered = rows.filter(r => {
    const okSearch = !search || [r.offerId, r.market, r.offerType, r.status].join(' ').toLowerCase().includes(search)
    const okStatus = !fStatus || r.status === fStatus
    const okMarket = !fMarket || r.market === fMarket
    const okLang = !fLang || r.language === fLang
    const okType = !fType || r.offerType === fType
    return okSearch && okStatus && okMarket && okLang && okType
  })

  const sorted = [...filtered]
  if (sortCol) {
    sorted.sort((a, b) => {
      const av = (a as any)[sortCol] || ''
      const bv = (b as any)[sortCol] || ''
      return sortDir * av.localeCompare(bv)
    })
  }

  const visible = sorted.slice(0, visibleCount)

  const uniqueStatuses = [...new Set(rows.map(r => r.status).filter(Boolean))].sort()
  const uniqueMarkets = [...new Set(rows.map(r => r.market).filter(Boolean))].sort()
  const uniqueLangs = [...new Set(rows.map(r => r.language).filter(Boolean))].sort()
  const uniqueTypes = [...new Set(rows.map(r => r.offerType).filter(Boolean))].sort()

  const thS: React.CSSProperties = {
    padding:'7px 10px', fontSize:'.54rem', fontWeight:700, letterSpacing:'.1em',
    textTransform:'uppercase' as const, color:'var(--text-3)',
    background:'var(--surface-2)', borderBottom:'1px solid var(--border)',
    textAlign:'left' as const, whiteSpace:'nowrap' as const,
    position:'sticky' as const, top:0, zIndex:2, cursor:'pointer', userSelect:'none'
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', paddingBottom:8, borderBottom:'1px solid var(--border)', marginBottom:8, flexShrink:0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
        <span style={{ fontSize:'.72rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--text)' }}>Offers Status</span>
        {loading && <span style={{ color:'var(--orange)', fontSize:'.58rem', display:'flex', alignItems:'center', gap:4 }}>
          <svg className="spinner" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 12a9 9 0 1 0 9-9A9.75 9.75 0 0 0 3.6 5.1L3 8"/><path d="M3 3v5h5"/></svg>
          Loading…</span>}
        {!loading && <span style={{ color:'var(--text-3)', fontSize:'.55rem' }}>{rows.length} offers loaded</span>}
        <button onClick={load} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:4, fontSize:'.6rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit', background:'var(--surface-2)', border:'1px solid var(--border)', color:'var(--text-2)' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9A9.75 9.75 0 0 0 3.6 5.1L3 8"/><path d="M3 3v5h5"/></svg>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:8, flexShrink:0, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:130, position:'relative' }}>
          <svg style={{ position:'absolute', left:7, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--text-3)' }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value.toLowerCase().trim())}
            style={{ width:'100%', paddingLeft:24, paddingRight:8, paddingTop:4, paddingBottom:4, background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:'inherit', fontSize:'0.68rem', outline:'none', height:28 }} />
        </div>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)}
          style={{ padding:'3px 8px', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text-2)', fontFamily:'inherit', fontSize:'0.62rem', outline:'none', cursor:'pointer', height:28 }}>
          <option value="">All Status</option>
          {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fMarket} onChange={e => setFMarket(e.target.value)}
          style={{ padding:'3px 8px', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text-2)', fontFamily:'inherit', fontSize:'0.62rem', outline:'none', cursor:'pointer', height:28 }}>
          <option value="">All Markets</option>
          {uniqueMarkets.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={fLang} onChange={e => setFLang(e.target.value)}
          style={{ padding:'3px 8px', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text-2)', fontFamily:'inherit', fontSize:'0.62rem', outline:'none', cursor:'pointer', height:28 }}>
          <option value="">All Languages</option>
          {uniqueLangs.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={fType} onChange={e => setFType(e.target.value)}
          style={{ padding:'3px 8px', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text-2)', fontFamily:'inherit', fontSize:'0.62rem', outline:'none', cursor:'pointer', height:28 }}>
          <option value="">All Types</option>
          {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ fontSize:'.6rem', color:'var(--text-3)', whiteSpace:'nowrap' }}>{filtered.length} of {rows.length}</span>
      </div>

      {/* Table */}
      <div style={{ flex:1, minHeight:0, overflowY:'auto', border:'1px solid var(--border)', borderRadius:6 }}>
        {loading && !rows.length ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:100, gap:8, color:'var(--text-3)', fontSize:'.72rem' }}>
            <svg className="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9A9.75 9.75 0 0 0 3.6 5.1L3 8"/><path d="M3 3v5h5"/></svg>
            Loading offers…
          </div>
        ) : error ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:100, gap:8, color:'var(--red)', fontSize:'.7rem' }}>
            {error}
            <button onClick={load} style={{ padding:'4px 12px', borderRadius:5, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text-2)', fontFamily:'inherit', fontSize:'0.65rem', cursor:'pointer' }}>Retry</button>
          </div>
        ) : !filtered.length ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:100, gap:6, color:'var(--text-3)', fontSize:'.7rem' }}>
            {rows.length ? 'No offers match your filters' : 'No offers loaded'}
          </div>
        ) : (
          <>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={thS} onClick={() => { if(sortCol==='offerId'){setSortDir(d=>d===-1?1:-1)} else {setSortCol('offerId');setSortDir(1)} }}>Offer ID {sortCol==='offerId'?(sortDir===-1?'↓':'↑'):''}</th>
                  <th style={{...thS, width:'18%'}}>Offer Link</th>
                  <th style={thS} onClick={() => { if(sortCol==='startDate'){setSortDir(d=>d===-1?1:-1)} else {setSortCol('startDate');setSortDir(1)} }}>Start {sortCol==='startDate'?(sortDir===-1?'↓':'↑'):''}</th>
                  <th style={thS} onClick={() => { if(sortCol==='endDate'){setSortDir(d=>d===-1?1:-1)} else {setSortCol('endDate');setSortDir(1)} }}>End {sortCol==='endDate'?(sortDir===-1?'↓':'↑'):''}</th>
                  <th style={thS} onClick={() => { if(sortCol==='language'){setSortDir(d=>d===-1?1:-1)} else {setSortCol('language');setSortDir(1)} }}>Lang {sortCol==='language'?(sortDir===-1?'↓':'↑'):''}</th>
                  <th style={thS} onClick={() => { if(sortCol==='market'){setSortDir(d=>d===-1?1:-1)} else {setSortCol('market');setSortDir(1)} }}>Market {sortCol==='market'?(sortDir===-1?'↓':'↑'):''}</th>
                  <th style={thS} onClick={() => { if(sortCol==='status'){setSortDir(d=>d===-1?1:-1)} else {setSortCol('status');setSortDir(1)} }}>Status {sortCol==='status'?(sortDir===-1?'↓':'↑'):''}</th>
                  <th style={thS} onClick={() => { if(sortCol==='offerType'){setSortDir(d=>d===-1?1:-1)} else {setSortCol('offerType');setSortDir(1)} }}>Type {sortCol==='offerType'?(sortDir===-1?'↓':'↑'):''}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => {
                  const st = statusBadgeStyle(r.status)
                  const tp = typeBadgeStyle(r.offerType)
                  const endPast = isPastToday(r.endDate) && r.status !== 'EXPIRED'
                  return (
                    <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='var(--surface-2)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=''}>
                      <td style={{ padding:'8px 10px', verticalAlign:'middle' }}>
                        {r.offerId ? (
                          <a href={r.offerId} target="_blank" rel="noreferrer" style={{ fontSize:'.65rem', fontFamily:'monospace', color:'var(--accent)', textDecoration:'none' }}>
                            {(r.offerId.match(/\/offers\/(\d+)/) || [])[1] || r.offerId.slice(-8)}
                          </a>
                        ) : <span style={{color:'var(--text-3)',fontSize:'.6rem'}}>—</span>}
                      </td>
                      <td style={{ padding:'8px 10px', verticalAlign:'middle' }}>
                        {r.offerLink ? (
                          <a href={r.offerLink} target="_blank" rel="noreferrer" style={{ fontSize:'.6rem', color:'var(--text-2)', textDecoration:'none', wordBreak:'break-all' }}>
                            {r.offerLink.length > 50 ? r.offerLink.slice(0,50)+'…' : r.offerLink}
                          </a>
                        ) : <span style={{color:'var(--text-3)',fontSize:'.6rem'}}>—</span>}
                      </td>
                      <td style={{ padding:'8px 10px', verticalAlign:'middle', fontSize:'.63rem', color:'var(--text-2)', whiteSpace:'nowrap' }}>{r.startDate}</td>
                      <td style={{ padding:'8px 10px', verticalAlign:'middle', fontSize:'.63rem', color: endPast ? 'var(--red)' : 'var(--text-2)', whiteSpace:'nowrap', fontWeight: endPast ? 700 : 400 }}>{r.endDate}</td>
                      <td style={{ padding:'8px 10px', verticalAlign:'middle', whiteSpace:'nowrap' }}>
                        {r.language ? (
                          <span style={{ display:'inline-block', padding:'1px 6px', borderRadius:3, fontSize:'.58rem', fontWeight:700, background:'var(--surface-3)', border:'1px solid var(--border)', color:'var(--text-2)' }}>/{r.language.toLowerCase()}/</span>
                        ) : <span style={{color:'var(--text-3)',fontSize:'.6rem'}}>—</span>}
                      </td>
                      <td style={{ padding:'8px 10px', verticalAlign:'middle', fontSize:'.65rem', color:'var(--text-2)', whiteSpace:'nowrap' }}>{r.market || '—'}</td>
                      <td style={{ padding:'8px 10px', verticalAlign:'middle', whiteSpace:'nowrap' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:20, fontSize:'.58rem', fontWeight:700, background:st.bg, border:`1px solid ${st.brd}`, color:st.color }}>
                          <span style={{ width:5, height:5, borderRadius:'50%', background:st.color, flexShrink:0 }} />
                          {r.status || '—'}
                        </span>
                      </td>
                      <td style={{ padding:'8px 10px', verticalAlign:'middle', whiteSpace:'nowrap' }}>
                        {r.offerType ? (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:20, fontSize:'.58rem', fontWeight:600, background:tp.bg, border:`1px solid ${tp.brd}`, color:tp.color }}>
                            {r.offerType}
                          </span>
                        ) : <span style={{color:'var(--text-3)',fontSize:'.6rem'}}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {visibleCount < filtered.length && (
              <div style={{ padding:'10px', textAlign:'center', borderTop:'1px solid var(--border)' }}>
                <button onClick={() => setVisibleCount(v => v + 50)}
                  style={{ padding:'5px 16px', borderRadius:5, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text-2)', fontFamily:'inherit', fontSize:'0.65rem', cursor:'pointer' }}>
                  Load More ({filtered.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page with Top Tab Switcher
// ─────────────────────────────────────────────────────────────────────────────
export function OfferGeneratorPage() {
  const [tab, setTab] = useState<'studio' | 'status'>('studio')
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const TOP = 60 + 41 // nav + tab bar

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <TopNav currentPage="offers" />

      {/* Tab bar */}
      <div style={{ position: 'fixed', top: 60, left: 0, right: 0, height: 41, background: isDark ? 'rgba(10,11,13,.97)' : 'rgba(255,255,255,.97)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 6, zIndex: 88, backdropFilter: 'blur(12px)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '.08em', color: 'var(--text)', marginRight: 8 }}>Offers Tools</span>
        {(['studio', 'status'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '4px 14px', borderRadius: 5, border: '1px solid', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 600, transition: 'all .15s',
              background: tab === t ? 'var(--accent-dim)' : 'none',
              borderColor: tab === t ? 'var(--accent-brd)' : 'var(--border)',
              color: tab === t ? 'var(--accent)' : 'var(--text-2)' }}>
            {t === 'studio' ? '📄 Offer Studio' : '📊 Offers Status'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ paddingTop: TOP, flex: 1, minHeight: `calc(100vh - ${TOP}px)`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '1.75rem 1.5rem 4rem', width: '100%', flex: 1, overflowY: 'auto' }}>
          {tab === 'studio' && <OfferStudio />}
          {tab === 'status' && <OfferStatusTab />}
        </div>
        <Footer />
      </div>
    </div>
  )
}
