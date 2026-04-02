import { useEffect, useState } from 'react'
import { fmtCountdown, msUntilWarsaw, msUntilDaily } from '../lib/clock'

interface Props {
  label: string
  sub: string
  link: string
  type: 'weekly' | 'daily' | 'offers'
}

export function MeetingCountdown({ label, sub, link, type }: Props) {
  const [txt, setTxt] = useState('--:--')

  useEffect(() => {
    function update() {
      let ms: number
      if (type === 'weekly') ms = msUntilWarsaw(13, 0, 1)
      else if (type === 'daily') ms = msUntilDaily()
      else ms = msUntilWarsaw(8, 0, 4)
      setTxt(fmtCountdown(ms))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [type])

  const isNow = txt === 'NOW'
  const isSoon = !isNow && (() => {
    const parts = txt.match(/^(\d+)h/)
    return parts ? parseInt(parts[1]) === 0 : false
  })()

  return (
    <a href={link} target="_blank" rel="noreferrer"
      className={`meeting-card ${isNow ? 'active-meeting' : ''}`}>
      <div style={{ fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.03em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
        className={isNow ? 'countdown-now' : isSoon ? 'countdown-soon' : ''}>
        {txt}
      </div>
      <div style={{ fontSize: '0.48rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{sub}</div>
    </a>
  )
}
