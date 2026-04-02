import { useEffect, useRef, useState } from 'react'
import { drawClock, getTimeIn } from '../lib/clock'

interface Props {
  city: string
  timezone: string
  size?: number
}

export function NavClock({ city, timezone, size = 34 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [timeStr, setTimeStr] = useState('--:--')
  const rafRef = useRef<number>(0)

  useEffect(() => {
    function tick() {
      if (canvasRef.current) drawClock(canvasRef.current, timezone)
      const t = getTimeIn(timezone)
      setTimeStr(`${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`)
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(rafRef.current)
  }, [timezone])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
      <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: '50%' }} />
      <div>
        <span style={{ fontSize: '0.52rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block' }}>{city}</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', letterSpacing: '0.05em', fontVariantNumeric: 'tabular-nums', display: 'block' }}>{timeStr}</span>
      </div>
    </div>
  )
}
