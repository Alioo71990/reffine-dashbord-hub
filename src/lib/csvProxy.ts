const PROXIES = [
  (u: string) => u,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`
]

export async function fetchWithProxy(url: string): Promise<string> {
  for (let i = 0; i < PROXIES.length; i++) {
    try {
      const res = await fetch(PROXIES[i](url), { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const t = text.trim()
      if (!t || t.length < 5) throw new Error('empty')
      if (t.startsWith('<')) throw new Error('got HTML')
      return text
    } catch (e) {
      console.warn(`Proxy ${i} failed:`, e)
    }
  }
  throw new Error('All proxies failed')
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let cur = '', inQ = false
  const cells: string[] = []
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (inQ && text[i + 1] === '"') { cur += '"'; i++ } else { inQ = !inQ }
    } else if (c === ',' && !inQ) {
      cells.push(cur.trim()); cur = ''
    } else if ((c === '\n' || c === '\r') && !inQ) {
      cells.push(cur.trim()); cur = ''
      if (cells.join('').trim()) rows.push([...cells])
      cells.length = 0
      if (c === '\r' && text[i + 1] === '\n') i++
    } else { cur += c }
  }
  if (cells.length || cur) { cells.push(cur.trim()); if (cells.join('').trim()) rows.push([...cells]) }
  return rows
}
