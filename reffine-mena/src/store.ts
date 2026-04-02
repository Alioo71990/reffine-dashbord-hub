import { create } from 'zustand'

// ── Theme ──
interface ThemeStore {
  theme: 'dark' | 'light'
  toggleTheme: () => void
  init: () => void
}
export const useTheme = create<ThemeStore>((set) => ({
  theme: 'dark',
  toggleTheme: () => set((s) => {
    const next = s.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('rf_theme', next)
    document.body.classList.toggle('rf-light', next === 'light')
    return { theme: next }
  }),
  init: () => {
    const saved = (localStorage.getItem('rf_theme') || 'dark') as 'dark' | 'light'
    document.body.classList.toggle('rf-light', saved === 'light')
    set({ theme: saved })
  }
}))

// ── Admin Config ──
interface AdminConfig {
  sbUrl: string; sbKey: string; groqKey: string; tasksCsvUrl: string
}
const DEFAULT_CONFIG: AdminConfig = {
  sbUrl: 'https://ijofjqnpbxfgvygdjjvh.supabase.co',
  sbKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqb2ZqcW5wYnhmZ3Z5Z2RqanZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDE3MjIsImV4cCI6MjA4OTI3NzcyMn0.TOIhsn9OB614ZlYdRYRAulDZOzxcQMkaPGaGBGbQ9rc',
  groqKey: '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',
  tasksCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT37HhHJ0CJ3SqWg8WV3Wa9HRAqxiRyYyuv5uwOqFRXaIzKDNID_gDMG8qTvkEAXVK9WveXpAoI9YKI/pub?gid=110196541&single=true&output=csv'
}
interface AdminStore {
  config: AdminConfig
  loadConfig: () => void
  saveConfig: (partial: Partial<AdminConfig>) => void
  resetConfig: () => void
}
export const useAdmin = create<AdminStore>((set) => ({
  config: DEFAULT_CONFIG,
  loadConfig: () => {
    try {
      const saved = JSON.parse(localStorage.getItem('rf_admin_config') || '{}')
      const csvOverride = localStorage.getItem('rf_tasks_csv_url')
      set({ config: { ...DEFAULT_CONFIG, ...saved, ...(csvOverride ? { tasksCsvUrl: csvOverride } : {}) } })
    } catch { set({ config: DEFAULT_CONFIG }) }
  },
  saveConfig: (partial) => set((s) => {
    const next = { ...s.config, ...partial }
    localStorage.setItem('rf_admin_config', JSON.stringify(next))
    if (partial.tasksCsvUrl !== undefined) localStorage.setItem('rf_tasks_csv_url', partial.tasksCsvUrl)
    return { config: next }
  }),
  resetConfig: () => {
    localStorage.removeItem('rf_admin_config')
    set({ config: DEFAULT_CONFIG })
  }
}))

// ── Auth ──
export interface ReffineUser {
  email: string; name?: string; avatar?: string
}
interface AuthStore {
  user: ReffineUser | null
  loading: boolean
  setUser: (u: ReffineUser | null) => void
  setLoading: (l: boolean) => void
  logout: () => void
}
export const useAuth = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => {
    if (user) localStorage.setItem('rf_user', JSON.stringify(user))
    else localStorage.removeItem('rf_user')
    set({ user, loading: false })
  },
  setLoading: (loading) => set({ loading }),
  logout: () => {
    localStorage.removeItem('rf_user')
    set({ user: null, loading: false })
  }
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
