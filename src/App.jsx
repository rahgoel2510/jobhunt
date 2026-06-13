import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './components/auth/AuthContext'
import LockScreen from './components/auth/LockScreen'
import Dashboard from './components/dashboard/Dashboard'
import Applications from './components/applications/Applications'
import Resumes from './components/resumes/Resumes'
import ExportImport from './components/shared/ExportImport'

function AppContent() {
  const { state, lock } = useAuth()
  const [tab, setTab] = useState(() => location.hash.slice(1) || 'dashboard')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    const onHash = () => setTab(location.hash.slice(1) || 'dashboard')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  if (state !== 'unlocked') return <LockScreen />

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'applications', label: 'Applications', icon: '💼' },
    { id: 'resumes', label: 'Resumes', icon: '📄' },
  ]

  function nav(id) { location.hash = id; setTab(id) }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top header — desktop */}
      <header className="hidden md:flex sticky top-0 z-50 backdrop-blur-md bg-bg/80 items-center justify-between px-6 py-2 border-b border-border">
        <nav className="flex gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => nav(t.id)}
              className={`${tab === t.id ? 'bg-accent text-white border-accent shadow-sm' : 'border-transparent bg-transparent hover:bg-bg-secondary'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
        <div className="flex gap-1">
          <button className="border-transparent bg-transparent hover:bg-bg-secondary" onClick={() => setDarkMode(d => !d)}>{darkMode ? '☀️' : '🌙'}</button>
          <button className="border-transparent bg-transparent hover:bg-bg-secondary" onClick={() => nav('export')}>💾</button>
          <button className="border-transparent bg-transparent hover:bg-bg-secondary" onClick={lock}>🔒</button>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-2 border-b border-border bg-bg-card sticky top-0 z-50">
        <h1 className="font-bold text-sm">Job Tracker</h1>
        <div className="flex gap-1">
          <button className="border-transparent bg-transparent hover:bg-bg-secondary !min-h-0 !py-1 !px-2" onClick={() => setDarkMode(d => !d)}>{darkMode ? '☀️' : '🌙'}</button>
          <button className="border-transparent bg-transparent hover:bg-bg-secondary !min-h-0 !py-1 !px-2" onClick={() => nav('export')}>💾</button>
          <button className="border-transparent bg-transparent hover:bg-bg-secondary !min-h-0 !py-1 !px-2" onClick={lock}>🔒</button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-4 pb-20 md:pb-4">
        {tab === 'dashboard' && <Dashboard onNavigate={nav} />}
        {tab === 'applications' && <Applications />}
        {tab === 'resumes' && <Resumes />}
        {tab === 'export' && <ExportImport />}
      </main>

      {/* Bottom tab bar — mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-card border-t border-border flex safe-bottom z-50">
        {tabs.map(t => (
          <button key={t.id} onClick={() => nav(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 border-0 rounded-none !min-h-0 ${tab === t.id ? 'text-accent' : 'text-muted'}`}>
            <span className="text-lg">{t.icon}</span>
            <span className="text-[10px] font-medium">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>
}
