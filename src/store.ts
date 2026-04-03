import { create } from 'zustand'

// ── Theme ──
interface ThemeStore { theme: 'dark'|'light'; toggleTheme: ()=>void; init: ()=>void }
export const useTheme = create<ThemeStore>((set) => ({
  theme: 'dark',
  init: () => {
    const t = (localStorage.getItem('rf_theme') || 'dark') as 'dark'|'light'
    document.body.classList.toggle('rf-light', t === 'light')
    set({ theme: t })
  },
  toggleTheme: () => set((s) => {
    const next = s.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('rf_theme', next)
    document.body.classList.toggle('rf-light', next === 'light')
    return { theme: next }
  })
}))

// ── Admin Config ──
export interface MeetingConfig {
  weeklyTime: string   // e.g. "13:00"
  weeklyDay: number    // 1=Mon
  weeklyLink: string
  dailyTime: string    // e.g. "07:45"
  dailyTimeThu: string // e.g. "07:30"
  dailyLink: string
  dailyLinkThu: string
  offersTime: string   // e.g. "08:00"
  offersDay: number    // 4=Thu
  offersLink: string
}

export interface AdminConfig {
  sbUrl: string
  sbKey: string
  groqKey: string
  tasksCsvUrl: string
  offersStatusUrl: string
  meetings: MeetingConfig
}

export const DEFAULT_MEETINGS: MeetingConfig = {
  weeklyTime: '13:00',
  weeklyDay: 1,
  weeklyLink: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_YzNkOTQ1YmYtYjQxMi00ZDZhLTk5MjAtNjQ0YWU4YzRmNmZm%40thread.v2/0?context=%7b%22Tid%22%3a%224c087f80-1e07-4f72-9e41-d7d9748d0f4c%22%2c%22Oid%22%3a%221c87e926-b217-48d0-8aac-71de272a3f6d%22%7d',
  dailyTime: '07:45',
  dailyTimeThu: '07:30',
  dailyLink: 'https://meet.google.com/pgy-nkum-gic',
  dailyLinkThu: 'https://meet.google.com/hxe-gzax-sre',
  offersTime: '08:00',
  offersDay: 4,
  offersLink: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_NWFjNDgyMGUtOTYyMy00ZjE3LWJmYzItOTk4NjBhNGEyYzkz%40thread.v2/0?context=%7b%22Tid%22%3a%2241eb501a-f671-4ce0-a5bf-b64168c3705f%22%2c%22Oid%22%3a%222ca169c9-6138-482a-8d04-0a07b414d160%22%7d',
}

const DEFAULT_CONFIG: AdminConfig = {
  sbUrl: 'https://ijofjqnpbxfgvygdjjvh.supabase.co',
  sbKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqb2ZqcW5wYnhmZ3Z5Z2RqanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDE3MjIsImV4cCI6MjA4OTI3NzcyMn0.TOIhsn9OB614ZlYdRYRAulDZOzxcQMkaPGaGBGbQ9rc',
  groqKey: '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',
  tasksCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT37HhHJ0CJ3SqWg8WV3Wa9HRAqxiRyYyuv5uwOqFRXaIzKDNID_gDMG8qTvkEAXVK9WveXpAoI9YKI/pub?gid=110196541&single=true&output=csv',
  offersStatusUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQL1YZ28A08mkRUpCQRvyp9aUDeNwC9tVCtZKH3Benr7Vepik7z8LzdV3qKKMeJiJP_Yfhnep2ynnLq/pub?output=csv',
  meetings: DEFAULT_MEETINGS
}

interface AdminStore {
  config: AdminConfig
  loadConfig: () => void
  saveConfig: (partial: Partial<AdminConfig>) => void
  saveMeetings: (m: Partial<MeetingConfig>) => void
  resetConfig: () => void
}

export const useAdmin = create<AdminStore>((set) => ({
  config: DEFAULT_CONFIG,
  loadConfig: () => {
    try {
      const saved = JSON.parse(localStorage.getItem('rf_admin_config') || '{}')
      const csvOverride = localStorage.getItem('rf_tasks_csv_url')
      const meetings = { ...DEFAULT_MEETINGS, ...(saved.meetings || {}) }
      set({ config: { ...DEFAULT_CONFIG, ...saved, meetings, ...(csvOverride ? { tasksCsvUrl: csvOverride } : {}) } })
    } catch { set({ config: DEFAULT_CONFIG }) }
  },
  saveConfig: (partial) => set((s) => {
    const next = { ...s.config, ...partial }
    localStorage.setItem('rf_admin_config', JSON.stringify(next))
    if (partial.tasksCsvUrl !== undefined) localStorage.setItem('rf_tasks_csv_url', partial.tasksCsvUrl)
    return { config: next }
  }),
  saveMeetings: (m) => set((s) => {
    const next = { ...s.config, meetings: { ...s.config.meetings, ...m } }
    localStorage.setItem('rf_admin_config', JSON.stringify(next))
    return { config: next }
  }),
  resetConfig: () => { localStorage.removeItem('rf_admin_config'); set({ config: DEFAULT_CONFIG }) }
}))

// ── Activity Log ──
export function addLog(msg: string) {
  try {
    const log = JSON.parse(localStorage.getItem('rf_admin_log') || '[]')
    log.unshift({ time: new Date().toLocaleString(), msg })
    if (log.length > 30) log.splice(30)
    localStorage.setItem('rf_admin_log', JSON.stringify(log))
  } catch {}
}
export function getLog(): { time: string; msg: string }[] {
  try { return JSON.parse(localStorage.getItem('rf_admin_log') || '[]') } catch { return [] }
}
