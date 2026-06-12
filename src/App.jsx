import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './components/auth/AuthContext'
import LockScreen from './components/auth/LockScreen'
import Dashboard from './components/dashboard/Dashboard'
import Applications from './components/applications/Applications'
import Retrospectives from './components/retrospectives/Retrospectives'
import Resumes from './components/resumes/Resumes'
import ExportImport from './components/shared/ExportImport'

function AppContent() {
  const { state, lock } = useAuth()
  const [tab, setTab] = useState(() => location.hash.slice(1) || 'dashboard')

  useEffect(() => {
    const onHash = () => setTab(location.hash.slice(1) || 'dashboard')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  if (state !== 'unlocked') return <LockScreen />

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'applications', label: 'Applications' },
    { id: 'resumes', label: 'Resumes' },
    { id: 'retro', label: 'Retrospectives' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-3">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-bg/80 flex items-center justify-between py-2 mb-4 border-b border-border">
        <nav className="flex gap-1 flex-wrap">
          {tabs.map(t => (
            <button key={t.id} onClick={() => { location.hash = t.id; setTab(t.id) }}
              className={tab === t.id ? 'bg-accent text-white border-accent shadow-sm shadow-accent/25' : 'border-transparent bg-transparent hover:bg-bg-secondary'}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex gap-1">
          <button className="border-transparent bg-transparent hover:bg-bg-secondary" onClick={() => setDarkMode(d => !d)} title="Toggle dark mode">{darkMode ? '☀️' : '🌙'}</button>
          <button className="border-transparent bg-transparent hover:bg-bg-secondary" onClick={() => { location.hash = 'export'; setTab('export') }}>💾</button>
          <button className="border-transparent bg-transparent hover:bg-bg-secondary" onClick={lock}>🔒</button>
        </div>
      </header>
      <main>
        {tab === 'dashboard' && <Dashboard onNavigate={t => { location.hash = t; setTab(t) }} />}
        {tab === 'applications' && <Applications />}
        {tab === 'resumes' && <Resumes />}
        {tab === 'retro' && <Retrospectives />}
        {tab === 'export' && <ExportImport />}
      </main>
    </div>
  )
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>
}
