import { useState, useEffect } from 'react'
import { store } from '../../lib/store'
import { format } from 'date-fns'

const CATEGORIES = ['Tailored', 'General']

export default function Resumes() {
  const [resumes, setResumes] = useState([])
  const [apps, setApps] = useState([])
  const [filter, setFilter] = useState('')

  const load = () => Promise.all([store.getAll('resumes').then(setResumes), store.getAll('applications').then(setApps)])
  useEffect(() => { load() }, [])

  function download(r) { const a = document.createElement('a'); a.href = r.data; a.download = r.fileName; a.click() }
  async function remove(id) { if (confirm('Delete this resume?')) { await store.delete('resumes', id); load() } }

  const filtered = filter ? resumes.filter(r => r.category === filter) : resumes
  const tailoredCount = resumes.filter(r => r.category === 'Tailored').length
  const generalCount = resumes.filter(r => r.category === 'General').length

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-lg">📄</div>
          <div><p className="text-2xl font-bold">{resumes.length}</p><p className="text-xs text-muted">Total Resumes</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-lg">🎯</div>
          <div><p className="text-2xl font-bold text-purple-700">{tailoredCount}</p><p className="text-xs text-muted">Tailored</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-lg">📋</div>
          <div><p className="text-2xl font-bold text-sky-700">{generalCount}</p><p className="text-xs text-muted">General</p></div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between">
        <div className="flex bg-bg-secondary rounded-lg p-0.5 gap-0.5">
          <button onClick={() => setFilter('')} className={`!min-h-0 !py-1.5 px-3 rounded-md border-0 text-sm ${!filter ? 'bg-bg-card shadow-sm font-bold' : 'bg-transparent text-muted'}`}>All ({resumes.length})</button>
          <button onClick={() => setFilter('Tailored')} className={`!min-h-0 !py-1.5 px-3 rounded-md border-0 text-sm ${filter === 'Tailored' ? 'bg-bg-card shadow-sm font-bold text-purple-700' : 'bg-transparent text-muted'}`}>🎯 Tailored</button>
          <button onClick={() => setFilter('General')} className={`!min-h-0 !py-1.5 px-3 rounded-md border-0 text-sm ${filter === 'General' ? 'bg-bg-card shadow-sm font-bold text-sky-700' : 'bg-transparent text-muted'}`}>📋 General</button>
        </div>
      </div>

      {/* Resume Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map(r => {
          const linkedApps = (r.linkedApps || []).map(id => apps.find(a => a.id === id)).filter(Boolean)
          return (
            <div key={r.id} className="card p-0 overflow-hidden hover:shadow-md transition-shadow">
              {/* Header bar */}
              <div className={`px-4 py-2 flex items-center gap-2 ${r.category === 'Tailored' ? 'bg-purple-50 border-b border-purple-100' : 'bg-sky-50 border-b border-sky-100'}`}>
                <span className="text-lg">{r.category === 'Tailored' ? '🎯' : '📋'}</span>
                <span className={`text-xs font-bold uppercase ${r.category === 'Tailored' ? 'text-purple-700' : 'text-sky-700'}`}>{r.category || 'General'}</span>
                <span className="text-xs text-muted ml-auto">{r.createdAt ? format(new Date(r.createdAt), 'MMM d, yyyy') : ''}</span>
              </div>

              {/* Body */}
              <div className="p-4">
                <h3 className="font-semibold text-sm mb-0.5">{r.name}</h3>
                <p className="text-xs text-muted mb-2">{r.fileName} · {r.type === 'application/pdf' ? 'PDF' : 'DOCX'}</p>

                {/* Tags */}
                {r.tags && r.tags.length > 0 && <div className="flex flex-wrap gap-1 mb-2">
                  {r.tags.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{t}</span>)}
                </div>}

                {/* Linked applications */}
                {linkedApps.length > 0 && <div className="mb-2">
                  <p className="text-[10px] uppercase font-bold text-muted mb-1">Linked to</p>
                  <div className="flex flex-wrap gap-1">
                    {linkedApps.map(a => <span key={a.id} className="text-[11px] px-2 py-0.5 rounded-full bg-bg-secondary font-medium">{a.company} · {a.role}</span>)}
                  </div>
                </div>}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-border">
                  <button onClick={() => download(r)} className="flex-1 !min-h-0 !py-1.5 text-xs">📥 Download</button>
                  <button className="!min-h-0 !py-1.5 text-xs text-danger border-danger/30 hover:bg-red-50" onClick={() => remove(r.id)}>🗑</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && <div className="card text-center py-12">
        <p className="text-3xl mb-2">📄</p>
        <p className="font-medium">No resumes yet</p>
        <p className="text-sm text-muted mt-1">Upload a resume from any job application and it'll appear here with tags.</p>
      </div>}
    </div>
  )
}
