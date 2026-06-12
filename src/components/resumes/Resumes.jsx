import { useState, useEffect } from 'react'
import { store } from '../../lib/store'

const CATEGORIES = ['Tailored', 'General']
const CAT_STYLES = { Tailored: 'bg-purple-50 text-purple-700', General: 'bg-sky-50 text-sky-700' }

export default function Resumes() {
  const [resumes, setResumes] = useState([])
  const [apps, setApps] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('General')
  const [file, setFile] = useState(null)
  const [linking, setLinking] = useState(null)
  const [filter, setFilter] = useState('')

  const load = () => Promise.all([store.getAll('resumes').then(setResumes), store.getAll('applications').then(setApps)])
  useEffect(() => { load() }, [])

  async function upload(e) {
    e.preventDefault()
    if (!file || !name.trim()) return
    const reader = new FileReader()
    reader.onload = async () => {
      await store.add('resumes', { name: name.trim(), category, fileName: file.name, type: file.type, data: reader.result, linkedApps: [], createdAt: new Date().toISOString() })
      setName(''); setFile(null); setCategory('General'); setShowForm(false); load()
    }
    reader.readAsDataURL(file)
  }

  function download(r) {
    const a = document.createElement('a')
    a.href = r.data; a.download = r.fileName; a.click()
  }

  async function toggleLink(resumeId, appId) {
    const resume = resumes.find(r => r.id === resumeId)
    const linked = resume.linkedApps || []
    const updated = linked.includes(appId) ? linked.filter(x => x !== appId) : [...linked, appId]
    await store.put('resumes', { ...resume, linkedApps: updated }); load()
  }

  async function remove(id) { if (confirm('Delete this resume?')) { await store.delete('resumes', id); load() } }

  const filtered = filter ? resumes.filter(r => r.category === filter) : resumes

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Resume Versions</h2>
        <div className="flex gap-2">
          <div className="flex bg-bg-secondary rounded-lg p-0.5 gap-0.5">
            <button onClick={() => setFilter('')} className={`text-[10px] px-2 py-1 rounded-md border-0 ${!filter ? 'bg-bg-card shadow-sm font-semibold' : 'bg-transparent text-muted'}`}>All</button>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setFilter(c)} className={`text-[10px] px-2 py-1 rounded-md border-0 ${filter === c ? 'bg-bg-card shadow-sm font-semibold' : 'bg-transparent text-muted'}`}>{c}</button>
            ))}
          </div>
          <button className="primary" onClick={() => setShowForm(!showForm)}>+ Upload</button>
        </div>
      </div>

      {showForm && <form onSubmit={upload} className="card p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label>Version Name</label><input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. SDE-v2-AWS-focus" /></div>
          <div>
            <label>Category</label>
            <div className="flex gap-1.5">
              {CATEGORIES.map(c => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={`flex-1 text-[11px] py-1.5 rounded-md border transition-all ${category === c ? (c === 'Tailored' ? 'bg-purple-50 text-purple-700 border-purple-200 font-semibold' : 'bg-sky-50 text-sky-700 border-sky-200 font-semibold') : 'bg-bg-secondary text-muted border-border'}`}>
                  {c === 'Tailored' ? '🎯' : '📋'} {c}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div><label>File (PDF/DOCX)</label><input type="file" accept=".pdf,.docx,.doc" onChange={e => setFile(e.target.files[0])} required /></div>
        <div className="flex gap-2">
          <button type="submit" className="primary">Upload</button>
          <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      </form>}

      <div className="space-y-2">
        {filtered.map(r => (
          <div key={r.id} className="card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${CAT_STYLES[r.category] || CAT_STYLES.General}`}>
                  {r.category === 'Tailored' ? '🎯' : '📋'} {r.category || 'General'}
                </span>
                <div>
                  <strong className="text-xs">{r.name}</strong>
                  <p className="text-[10px] text-muted">{r.fileName}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button className="border-transparent bg-transparent hover:bg-bg-secondary text-sm" onClick={() => download(r)}>📥</button>
                <button className="border-transparent bg-transparent hover:bg-bg-secondary text-sm" onClick={() => setLinking(linking === r.id ? null : r.id)}>🔗</button>
                <button className="border-transparent bg-transparent hover:bg-bg-secondary text-sm text-danger" onClick={() => remove(r.id)}>🗑</button>
              </div>
            </div>
            {(r.linkedApps || []).length > 0 && <p className="text-[10px] text-muted mt-1.5">🔗 Linked to: {r.linkedApps.map(id => apps.find(a => a.id === id)?.company).filter(Boolean).join(', ')}</p>}
            {linking === r.id && <div className="mt-2 max-h-32 overflow-y-auto border border-border rounded-md p-2">
              {apps.length === 0 ? <p className="text-[10px] text-muted">No applications yet</p> : apps.map(a => (
                <label key={a.id} className="flex items-center gap-2 py-0.5 text-[11px] cursor-pointer">
                  <input type="checkbox" checked={(r.linkedApps || []).includes(a.id)} onChange={() => toggleLink(r.id, a.id)} className="w-3 h-3" />
                  {a.company} — {a.role}
                </label>
              ))}
            </div>}
          </div>
        ))}
        {filtered.length === 0 && !showForm && <p className="text-muted text-xs text-center py-8">{filter ? `No ${filter.toLowerCase()} resumes.` : 'No resumes uploaded yet.'}</p>}
      </div>
    </div>
  )
}
