import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTheme, useAdmin } from './store'
import { DashboardPage } from './pages/DashboardPage'
import { TranslationPage } from './pages/TranslationPage'
import { TranslationToolPage } from './pages/TranslationToolPage'
import { SEOToolPage } from './pages/SEOToolPage'
import { OfferGeneratorPage } from './pages/OfferGeneratorPage'
import { RetailerLocatorPage } from './pages/RetailerLocatorPage'
import { NavToolsPage } from './pages/NavToolsPage'
import { AdminPage } from './pages/AdminPage'

function AppBootstrap() {
  const { init } = useTheme()
  const { loadConfig } = useAdmin()
  useEffect(() => { init(); loadConfig() }, [])
  return null
}

export default function App() {
  return (
    <BrowserRouter basename="/reffine-dashbord-hub">
      <AppBootstrap />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/translate" element={<TranslationPage />} />
        <Route path="/translate-tool" element={<TranslationToolPage />} />
        <Route path="/seo" element={<SEOToolPage />} />
        <Route path="/offers" element={<OfferGeneratorPage />} />
        <Route path="/retailers" element={<RetailerLocatorPage />} />
        <Route path="/nav-tools" element={<NavToolsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
