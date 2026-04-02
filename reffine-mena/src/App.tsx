import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useTheme, useAuth, useAdmin } from './store'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { TranslationPage } from './pages/TranslationPage'
import { TranslationToolPage } from './pages/TranslationToolPage'
import { SEOToolPage } from './pages/SEOToolPage'
import { OfferGeneratorPage } from './pages/OfferGeneratorPage'
import { RetailerLocatorPage } from './pages/RetailerLocatorPage'
import { AdminPage } from './pages/AdminPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', flexDirection:'column', gap:12 }}>
      <svg style={{ animation:'spin .7s linear infinite' }} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
        <path d="M3 12a9 9 0 1 0 9-9A9.75 9.75 0 0 0 3.6 5.1L3 8"/><path d="M3 3v5h5"/>
      </svg>
      <span style={{ fontSize:'0.75rem', color:'var(--text-3)' }}>Loading…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

function AppBootstrap() {
  const { init } = useTheme()
  const { setUser, setLoading } = useAuth()
  const { loadConfig } = useAdmin()

  useEffect(() => {
    init()
    loadConfig()

    // Restore persisted session
    try {
      const saved = localStorage.getItem('rf_user')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.email) { setUser(parsed); return }
      }
    } catch {}
    setLoading(false)
  }, [])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AppBootstrap />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/translate" element={<ProtectedRoute><TranslationPage /></ProtectedRoute>} />
        <Route path="/translate-tool" element={<ProtectedRoute><TranslationToolPage /></ProtectedRoute>} />
        <Route path="/seo" element={<ProtectedRoute><SEOToolPage /></ProtectedRoute>} />
        <Route path="/offers" element={<ProtectedRoute><OfferGeneratorPage /></ProtectedRoute>} />
        <Route path="/retailers" element={<ProtectedRoute><RetailerLocatorPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
