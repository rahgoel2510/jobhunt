import { useState, useEffect } from 'react'
import { store } from '../../lib/store'

export default function Resumes() {
  const [resumes, setResumes] = useState([])
  const [apps, setApps] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)
  const [linking, setLinking] = useState(null)

  const load = () => Promise.all([store.getAll('resumes').then(setResumes), store.getAll('applications').then(setApps)])
  useEffect(() => { load() }, [])

  async function upload(e) {
    e.preventDefault()
    if (!file || !name.trim()) return
    const reader = new FileReader()
    reader.onload = async () => {
      await store.add('resumes', { name: name.trim(), fileName: file.name, type: file.type, data: reader.result, linkedApps: [], createdAt: new Date().toISOString() })
      setName(''); setFile(null); setShowForm(false); load()
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Resume Versions</h2>
        <button className="primary" onClick={() => setShowForm(!showForm)}>+ Upload</button>
      </div>

      {showForm && <form onSubmit={upload} className="card p-3 space-y-2">
        <div><label>Version Name (e.g. "TPM-v3-AWS-focus")</label><input value={name} onChange={e => setName(e.target.value)} required /></div>
        <div><label>File (PDF/DOCX)</label><input type="file" accept=".pdf,.docx,.doc" onChange={e => setFile(e.target.files[0])} required /></div>
        <button type="submit" className="primary">Upload</button>
      </form>}

      <div className="space-y-2">
        {resumes.map(r => (
          <div key={r.id} className="card p-3">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-xs">{r.name}</strong>
                <p className="text-[10px] text-muted">{r.fileName}</p>
              </div>
              <div className="flex gap-1">
                <button className="border-transparent bg-transparent hover:bg-bg-secondary text-sm" onClick={() => download(r)}>📥</button>
                <button className="border-transparent bg-transparent hover:bg-bg-secondary text-sm" onClick={() => setLinking(linking === r.id ? null : r.id)}>🔗</button>
                <button className="border-transparent bg-transparent hover:bg-bg-secondary text-sm text-danger" onClick={() => remove(r.id)}>🗑</button>
              </div>
            </div>
            {(r.linkedApps || []).length > 0 && <p className="text-[10px] text-muted mt-1">Linked to: {r.linkedApps.map(id => apps.find(a => a.id === id)?.company).filter(Boolean).join(', ')}</p>}
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
        {resumes.length === 0 && !showForm && <p className="text-muted text-xs text-center py-8">No resumes uploaded yet.</p>}
      </div>
    </div>
  )
}
