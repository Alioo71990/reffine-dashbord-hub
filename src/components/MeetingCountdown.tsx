import { useEffect, useState } from 'react'
import { fmtCountdown, msUntilWarsaw } from '../lib/clock'

// Compute ms until next occurrence of a time in Warsaw timezone
function msUntilDailyCustom(normalH: number, normalMin: number, thuH: number, thuMin: number): number {
  const nowMs = Date.now()
  function getOffset() {
    const s = new Date(nowMs).toLocaleString('en-US', { timeZone:'Europe/Warsaw', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false })
    const match = s.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+):(\d+)/)
    if (!match) return 3600000
    let h = parseInt(match[4]); if (h===24) h=0
    return Date.UTC(+match[3], +match[1]-1, +match[2], h, +match[5], +match[6]) - nowMs
  }
  const off = getOffset()
  const wNowMs = nowMs + off
  for (let i = 0; i <= 7; i++) {
    const b = new Date(wNowMs)
    const dayW = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + i, 0, 0, 0)
    const isThu = new Date(dayW).getUTCDay() === 4
    const cW = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + i, isThu ? thuH : normalH, isThu ? thuMin : normalMin, 0)
    const cU = cW - off
    if (cU > nowMs) return cU - nowMs
  }
  return 86400000
}

type Schedule =
  | { type: 'weekly'; day: number; h: number; min: number }
  | { type: 'daily'; normalH: number; normalMin: number; thuH: number; thuMin: number }

interface Props {
  label: string
  subLabel: string
  href: string
  schedule: Schedule
  // Legacy props
  sub?: string
  link?: string
  type?: 'weekly' | 'daily' | 'offers'
}

export function MeetingCountdown({ label, subLabel, href, schedule, sub, link, type }: Props) {
  const [txt, setTxt] = useState('--:--')

  useEffect(() => {
    function update() {
      let ms: number
      // Legacy support
      if (type && !schedule) {
        if (type === 'weekly') ms = msUntilWarsaw(13, 0, 1)
        else if (type === 'daily') ms = msUntilDailyCustom(7, 45, 7, 30)
        else ms = msUntilWarsaw(8, 0, 4)
      } else if (schedule.type === 'weekly') {
        ms = msUntilWarsaw(schedule.h, schedule.min, schedule.day)
      } else {
        ms = msUntilDailyCustom(schedule.normalH, schedule.normalMin, schedule.thuH, schedule.thuMin)
      }
      setTxt(fmtCountdown(ms))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [schedule, type])

  const isNow = txt === 'NOW'
  const isSoon = !isNow && txt.startsWith('00h')

  return (
    <a href={href || link || '#'} target="_blank" rel="noreferrer"
      className={`meeting-card ${isNow ? 'active-meeting' : ''}`}>
      <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-2)', whiteSpace:'nowrap' }}>{label}</div>
      <div style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.03em', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}
        className={isNow ? 'countdown-now' : isSoon ? 'countdown-soon' : ''}>
        {txt}
      </div>
      <div style={{ fontSize:'0.48rem', color:'var(--text-3)', whiteSpace:'nowrap' }}>{subLabel || sub}</div>
    </a>
  )
}
