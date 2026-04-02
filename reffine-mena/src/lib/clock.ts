export function getTimeIn(tz: string): Date {
  try {
    return new Date(new Date().toLocaleString('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric'
    }))
  } catch { return new Date() }
}

export function drawClock(canvas: HTMLCanvasElement, tz: string): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width, CX = W / 2, CY = W / 2, R = W / 2 - 1
  ctx.clearRect(0, 0, W, W)
  const now = getTimeIn(tz)
  const sec = now.getSeconds(), min = now.getMinutes()
  const hr = now.getHours() % 12, ms = now.getMilliseconds()

  ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2)
  ctx.fillStyle = '#1c1f28'; ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.stroke()

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2
    ctx.beginPath()
    ctx.moveTo(CX + Math.cos(a) * (R - 2), CY + Math.sin(a) * (R - 2))
    ctx.lineTo(CX + Math.cos(a) * (R - 5), CY + Math.sin(a) * (R - 5))
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke()
  }

  ctx.lineCap = 'round'
  const hA = ((hr + min / 60) / 12) * Math.PI * 2 - Math.PI / 2
  ctx.beginPath(); ctx.moveTo(CX, CY)
  ctx.lineTo(CX + Math.cos(hA) * R * 0.45, CY + Math.sin(hA) * R * 0.45)
  ctx.strokeStyle = '#eceef2'; ctx.lineWidth = 2; ctx.stroke()

  const mA = ((min + sec / 60) / 60) * Math.PI * 2 - Math.PI / 2
  ctx.beginPath(); ctx.moveTo(CX, CY)
  ctx.lineTo(CX + Math.cos(mA) * R * 0.62, CY + Math.sin(mA) * R * 0.62)
  ctx.strokeStyle = 'rgba(236,238,242,0.75)'; ctx.lineWidth = 1.5; ctx.stroke()

  const sA = ((sec + ms / 1000) / 60) * Math.PI * 2 - Math.PI / 2
  ctx.beginPath(); ctx.moveTo(CX, CY)
  ctx.lineTo(CX + Math.cos(sA) * R * 0.7, CY + Math.sin(sA) * R * 0.7)
  ctx.strokeStyle = '#00d084'; ctx.lineWidth = 1
  ctx.shadowColor = '#00d084'; ctx.shadowBlur = 3; ctx.stroke(); ctx.shadowBlur = 0

  ctx.beginPath(); ctx.arc(CX, CY, 2, 0, Math.PI * 2)
  ctx.fillStyle = '#eceef2'; ctx.fill()
}

// Warsaw offset in ms (DST-aware)
export function getWarsawOffsetMs(nowMs: number): number {
  const d = new Date(nowMs)
  const s = d.toLocaleString('en-US', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
  const m = s.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+):(\d+)/)
  if (!m) return 3600000
  let h = parseInt(m[4]); if (h === 24) h = 0
  return Date.UTC(+m[3], +m[1] - 1, +m[2], h, +m[5], +m[6]) - nowMs
}

export function msUntilWarsaw(tH: number, tM: number, dow: number | null, nowMs?: number): number {
  const now = nowMs ?? Date.now()
  const off = getWarsawOffsetMs(now)
  const wNow = now + off
  for (let i = 0; i <= 7; i++) {
    const b = new Date(wNow)
    const cW = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + i, tH, tM, 0)
    const cU = cW - off
    if (dow !== null && new Date(cW).getUTCDay() !== dow) continue
    if (cU > now) return cU - now
  }
  return 86400000
}

export function msUntilDaily(nowMs?: number): number {
  const now = nowMs ?? Date.now()
  const off = getWarsawOffsetMs(now)
  const wNow = now + off
  for (let i = 0; i <= 7; i++) {
    const b = new Date(wNow)
    const dW = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + i, 0, 0, 0)
    const isThu = new Date(dW).getUTCDay() === 4
    const cW = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + i, 7, isThu ? 30 : 45, 0)
    const cU = cW - off
    if (cU > now) return cU - now
  }
  return 86400000
}

export function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'NOW'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sc = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return d > 0 ? `${d}d:${p(h)}h:${p(m)}m` : `${p(h)}h:${p(m)}m:${p(sc)}s`
}
