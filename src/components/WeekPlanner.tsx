import { useState, useEffect, useRef, useCallback } from 'react'
import { useAdmin } from '../store'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface Member { id: string; name: string; color: string; initials: string }
interface Task {
  id: string; title: string; assigned_to: string | null
  date: string; start_time: string; end_time: string
  color: string; notes: string
}

const COLORS = [
  { id: 'tc-green',  hex: '#00d084', bg: 'rgba(0,208,132,.15)',  border: '#00d084' },
  { id: 'tc-blue',   hex: '#5b8dee', bg: 'rgba(91,141,238,.15)', border: '#5b8dee' },
  { id: 'tc-orange', hex: '#e8973a', bg: 'rgba(232,151,58,.15)', border: '#e8973a' },
  { id: 'tc-red',    hex: '#e8424a', bg: 'rgba(232,66,74,.15)',  border: '#e8424a' },
  { id: 'tc-purple', hex: '#9b7ee8', bg: 'rgba(155,126,232,.15)',border: '#9b7ee8' },
  { id: 'tc-gold',   hex: '#c9a96e', bg: 'rgba(201,169,110,.15)',border: '#c9a96e' },
]

const DEMO_MEMBERS: Member[] = [
  { id: '1', name: 'Piotr K.', color: '#00d084', initials: 'PK' },
  { id: '2', name: 'Patryk S.', color: '#5b8dee', initials: 'PS' },
  { id: '3', name: 'Bartosz T.', color: '#e8973a', initials: 'BT' },
  { id: '4', name: 'Maciej S.', color: '#9b7ee8', initials: 'MS' },
  { id: '5', name: 'Kacper G.', color: '#e8424a', initials: 'KG' },
  { id: '6', name: 'Marcin B.', color: '#c9a96e', initials: 'MB' },
]

const DEMO_TASKS: Task[] = [] // Empty initially, users add tasks

function getWeekDates(offset: number): Date[] {
  const now = new Date()
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d })
}

function getWeekNumber(d: Date): number {
  const jan1 = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
}

function toMin(t: string): number {
  if (!t) return 0
  const [h, m] = t.replace(/\s*(AM|PM)/i, '').split(':').map(Number)
  const isPM = /PM/i.test(t)
  return ((isPM && h !== 12 ? h + 12 : !isPM && h === 12 ? 0 : h) * 60) + (m || 0)
}

function fmt(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

const HOUR_START = 7, HOUR_END = 20, CELL_H = 36 // px per 30 min

function useSupabase(url: string, key: string): SupabaseClient | null {
  const ref = useRef<SupabaseClient | null>(null)
  if (url && key && !ref.current) {
    try { ref.current = createClient(url, key) } catch {}
  }
  return ref.current
}

export function WeekPlanner() {
  const { config } = useAdmin()
  const sb = useSupabase(config.sbUrl, config.sbKey)

  const [weekOffset, setWeekOffset] = useState(0)
  const [tasks, setTasks] = useState<Task[]>(DEMO_TASKS)
  const [members, setMembers] = useState<Member[]>(DEMO_MEMBERS)
  const [hiddenMembers, setHiddenMembers] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<{ open: boolean; date?: string; task?: Task | null }>({ open: false })
  const [nowLine, setNowLine] = useState(0)
  const calRef = useRef<HTMLDivElement>(null)

  const weekDates = getWeekDates(weekOffset)
  const todayStr = fmt(new Date())
  const weekNum = getWeekNumber(weekDates[0])
  const dateRange = `${weekDates[0].toLocaleDateString('en-GB', { day:'numeric', month:'short' })} – ${weekDates[6].toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}`

  // Supabase sync
  useEffect(() => {
    if (!sb) return
    sb.from('tasks').select('*').then(({ data }) => { if (data) setTasks(data as Task[]) })
    sb.from('members').select('*').then(({ data }) => { if (data && data.length) setMembers(data as Member[]) })
    const sub = sb.channel('tasks').on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
      sb.from('tasks').select('*').then(({ data }) => { if (data) setTasks(data as Task[]) })
    }).subscribe()
    return () => { sub.unsubscribe() }
  }, [sb])

  // Now line
  useEffect(() => {
    function update() {
      const now = new Date()
      const mins = now.getHours() * 60 + now.getMinutes()
      const offset = (mins - HOUR_START * 60) / 30 * CELL_H
      setNowLine(Math.max(0, offset))
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [])

  async function saveTask(data: Partial<Task> & { id?: string }) {
    if (sb) {
      if (data.id) {
        await sb.from('tasks').update(data).eq('id', data.id)
      } else {
        await sb.from('tasks').insert([data])
      }
      const { data: refreshed } = await sb.from('tasks').select('*')
      if (refreshed) setTasks(refreshed as Task[])
    } else {
      // Local fallback
      setTasks(prev => {
        if (data.id) return prev.map(t => t.id === data.id ? { ...t, ...data } : t)
        return [...prev, { id: Date.now().toString(), title: '', assigned_to: null, date: '', start_time: '09:00', end_time: '10:00', color: 'tc-green', notes: '', ...data }]
      })
    }
    setModal({ open: false })
  }

  async function deleteTask(id: string) {
    if (sb) await sb.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
    setModal({ open: false })
  }

  const totalRows = (HOUR_END - HOUR_START) * 2 // 30-min slots

  // Column widths
  const TIME_COL = 44
  const DAY_COLS = 7

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)', marginBottom: '0.75rem', flexWrap: 'wrap', flexShrink: 0 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text)' }}>Week Planner</span>
        <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent-brd)', padding: '0.18rem 0.55rem', borderRadius: 3 }}>W{weekNum}</span>
        <span style={{ fontSize: '0.58rem', color: 'var(--text-3)' }}>{dateRange}</span>
        {!sb && <span style={{ fontSize: '0.55rem', color: 'var(--orange)', background: 'var(--orange-dim)', padding: '2px 6px', borderRadius: 3, border: '1px solid rgba(232,151,58,.25)' }}>Local mode — connect Supabase in Admin to sync</span>}
        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
          <button className="btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: '0.65rem' }} onClick={() => setWeekOffset(o => o - 1)}>←</button>
          <button className="btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: '0.65rem', color: 'var(--accent)', borderColor: 'var(--accent-brd)', background: 'var(--accent-dim)' }} onClick={() => setWeekOffset(0)}>Today</button>
          <button className="btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: '0.65rem' }} onClick={() => setWeekOffset(o => o + 1)}>→</button>
        </div>
      </div>

      {/* Members */}
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.7rem', flexShrink: 0 }}>
        {members.map(m => (
          <button key={m.id} onClick={() => setHiddenMembers(prev => { const s = new Set(prev); if (s.has(m.id)) s.delete(m.id); else s.add(m.id); return s })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0.18rem 0.5rem', borderRadius: 20, fontSize: '0.58rem', fontWeight: 600, cursor: 'pointer', border: `1px solid ${m.color}44`, background: hiddenMembers.has(m.id) ? 'transparent' : `${m.color}18`, color: hiddenMembers.has(m.id) ? 'var(--text-3)' : m.color, opacity: hiddenMembers.has(m.id) ? 0.35 : 1, transition: 'all .15s' }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.45rem', fontWeight: 700, color: '#000', flexShrink: 0 }}>{m.initials}</span>
            {m.name}
          </button>
        ))}
      </div>

      {/* Calendar */}
      <div ref={calRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `${TIME_COL}px repeat(${DAY_COLS}, 1fr)`, minWidth: 600 }}>
          {/* Header row */}
          <div style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', padding: '.3rem .35rem', fontSize: '.5rem', fontWeight: 700, letterSpacing: '.1em', color: 'var(--text-3)', textAlign: 'right', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 3 }}>Time</div>
          {weekDates.map((d, di) => {
            const isToday = fmt(d) === todayStr
            return (
              <div key={di} style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', borderLeft: '1px solid rgba(255,255,255,.05)', padding: '.3rem .25rem', fontSize: '.6rem', fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', color: isToday ? 'var(--accent)' : 'var(--text-2)', position: 'sticky', top: 0, zIndex: 3, whiteSpace: 'nowrap' }}>
                {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                <span style={{ fontSize: '.78rem', fontWeight: 700, display: 'block', lineHeight: 1, marginTop: 1 }}>{d.getDate()}</span>
              </div>
            )
          })}

          {/* Time rows */}
          {Array.from({ length: totalRows }, (_, rowIdx) => {
            const totalMins = HOUR_START * 60 + rowIdx * 30
            const hour = Math.floor(totalMins / 60)
            const minute = totalMins % 60
            const isMajor = minute === 0
            const timeLabel = isMajor ? `${String(hour).padStart(2,'0')}:00` : ''

            return [
              // Time cell
              <div key={`t-${rowIdx}`} style={{ borderRight: '1px solid var(--border)', borderBottom: isMajor ? '1px solid rgba(255,255,255,.06)' : '1px solid rgba(255,255,255,.025)', padding: '0 .3rem', fontSize: '.5rem', color: isMajor ? 'var(--text-2)' : 'var(--text-3)', textAlign: 'right', height: CELL_H, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontWeight: isMajor ? 600 : 400, boxSizing: 'border-box' }}>
                {timeLabel}
              </div>,
              // Day cells
              ...weekDates.map((d, di) => {
                const dateStr = fmt(d)
                const isToday = dateStr === todayStr
                const dayTasks = tasks.filter(t => t.date === dateStr && !hiddenMembers.has(t.assigned_to || ''))

                return (
                  <div key={`c-${rowIdx}-${di}`}
                    style={{ borderLeft: '1px solid rgba(255,255,255,.04)', borderBottom: isMajor ? '1px solid rgba(255,255,255,.06)' : '1px solid rgba(255,255,255,.025)', height: CELL_H, position: 'relative', cursor: 'pointer', transition: 'background .1s', background: isToday ? 'rgba(0,208,132,.018)' : 'transparent', boxSizing: 'border-box' }}
                    onClick={() => setModal({ open: true, date: dateStr, task: null })}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isToday ? 'rgba(0,208,132,.045)' : 'rgba(255,255,255,.025)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isToday ? 'rgba(0,208,132,.018)' : 'transparent'}>
                    {/* Tasks that start in this slot */}
                    {rowIdx === 0 && dayTasks.map(task => {
                      const c = COLORS.find(col => col.id === task.color) || COLORS[0]
                      const startMins = toMin(task.start_time) - HOUR_START * 60
                      const endMins = toMin(task.end_time) - HOUR_START * 60
                      const top = (startMins / 30) * CELL_H
                      const height = Math.max(CELL_H * 0.8, ((endMins - startMins) / 30) * CELL_H - 2)
                      const member = members.find(m => m.id === task.assigned_to)
                      return (
                        <div key={task.id}
                          style={{ position: 'absolute', left: 2, right: 2, top, height, borderRadius: 3, padding: '2px 4px', fontSize: '.55rem', fontWeight: 600, cursor: 'pointer', overflow: 'hidden', zIndex: 1, transition: 'filter .1s', display: 'flex', flexDirection: 'column', background: c.bg, borderLeft: `3px solid ${c.border}`, color: c.hex }}
                          onClick={e => { e.stopPropagation(); setModal({ open: true, date: task.date, task }) }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25 }}>{task.title}</div>
                          {member && <div style={{ fontSize: '.48rem', opacity: .7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</div>}
                        </div>
                      )
                    })}
                  </div>
                )
              })
            ]
          }).flat()}
        </div>

        {/* Now line */}
        {weekOffset === 0 && (() => {
          const todayIdx = weekDates.findIndex(d => fmt(d) === todayStr)
          if (todayIdx < 0) return null
          const top = nowLine + CELL_H // +1 for header row
          return (
            <div style={{ position: 'absolute', top, left: TIME_COL + (todayIdx / 7) * (calRef.current?.clientWidth ? calRef.current.clientWidth - TIME_COL : 0), right: ((6 - todayIdx) / 7) * (calRef.current?.clientWidth ? calRef.current.clientWidth - TIME_COL : 0), height: 2, background: 'var(--accent)', pointerEvents: 'none', zIndex: 4 }}>
              <div style={{ position: 'absolute', left: 0, top: -3, width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
            </div>
          )
        })()}
      </div>

      {/* Modal */}
      {modal.open && (
        <TaskModal
          date={modal.date || todayStr}
          task={modal.task || null}
          members={members}
          onSave={saveTask}
          onDelete={deleteTask}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}

function TaskModal({ date, task, members, onSave, onDelete, onClose }: {
  date: string; task: Task | null; members: Member[]
  onSave: (d: Partial<Task> & { id?: string }) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(task?.title || '')
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to || '')
  const [startTime, setStartTime] = useState(task?.start_time || '09:00')
  const [endTime, setEndTime] = useState(task?.end_time || '10:00')
  const [color, setColor] = useState(task?.color || 'tc-green')
  const [notes, setNotes] = useState(task?.notes || '')
  const [taskDate, setTaskDate] = useState(task?.date || date)

  const iS: React.CSSProperties = { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontFamily: "'Inter',sans-serif", fontSize: '.72rem', padding: '.4rem .6rem', outline: 'none', transition: 'border-color .14s', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '1.35rem', width: 320, maxWidth: '93vw', display: 'flex', flexDirection: 'column', gap: '.65rem', boxShadow: '0 24px 60px rgba(0,0,0,.75)' }}>
        <div style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text)', paddingBottom: '.5rem', borderBottom: '1px solid var(--border)' }}>
          {task ? 'Edit Task' : 'New Task'}
        </div>

        <div><label style={{ fontSize: '.52rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '.25rem' }}>Title</label>
          <input style={iS} value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title…" autoFocus /></div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
          <div><label style={{ fontSize: '.52rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '.25rem' }}>Date</label>
            <input style={{ ...iS, colorScheme: 'dark' }} type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)} /></div>
          <div><label style={{ fontSize: '.52rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '.25rem' }}>Assigned to</label>
            <select style={iS} value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
              <option value="">—</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
          <div><label style={{ fontSize: '.52rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '.25rem' }}>Start</label>
            <input style={iS} type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
          <div><label style={{ fontSize: '.52rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '.25rem' }}>End</label>
            <input style={iS} type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
        </div>

        <div>
          <label style={{ fontSize: '.52rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '.25rem' }}>Color</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button key={c.id} onClick={() => setColor(c.id)}
                style={{ width: 22, height: 22, borderRadius: '50%', background: c.hex, border: `2px solid ${color === c.id ? '#fff' : 'transparent'}`, cursor: 'pointer', outline: color === c.id ? `2px solid ${c.hex}` : 'none', outlineOffset: 2 }} />
            ))}
          </div>
        </div>

        <div><label style={{ fontSize: '.52rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '.25rem' }}>Notes</label>
          <textarea style={{ ...iS, resize: 'vertical', minHeight: 48 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" /></div>

        <div style={{ display: 'flex', gap: '.4rem', justifyContent: 'flex-end', paddingTop: '.3rem', borderTop: '1px solid var(--border)' }}>
          {task && <button onClick={() => onDelete(task.id)} style={{ padding: '.34rem .75rem', borderRadius: 4, fontSize: '.63rem', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(232,66,74,.3)', background: 'rgba(232,66,74,.1)', color: '#e8424a', marginRight: 'auto', fontFamily: 'inherit' }}>Delete</button>}
          <button onClick={onClose} style={{ padding: '.34rem .75rem', borderRadius: 4, fontSize: '.63rem', fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={() => onSave({ ...(task ? { id: task.id } : {}), title, assigned_to: assignedTo || null, date: taskDate, start_time: startTime, end_time: endTime, color, notes })}
            style={{ padding: '.34rem .75rem', borderRadius: 4, fontSize: '.63rem', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(0,208,132,.3)', background: 'rgba(0,208,132,.1)', color: 'var(--accent)', fontFamily: 'inherit' }}>
            {task ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
