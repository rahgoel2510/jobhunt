import { useState, useEffect } from 'react'
import { store } from '../../lib/store'

export default function PrepLibrary() {
  const [guides, setGuides] = useState([])
  const [apps, setApps] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(null)

  const load = () => Promise.all([store.getAll('prepGuides').then(setGuides), store.getAll('applications').then(setApps)])
  useEffect(() => { load() }, [])

  const emptyForm = { applicationId: '', companyResearch: '', talkingPoints: '', anticipatedQuestions: '', storyBankLinks: '' }

  function startNew() { setForm(emptyForm); setEditing('new') }
  function startEdit(g) { setForm(g); setEditing(g.id) }

  async function save(e) {
    e.preventDefault()
    if (editing === 'new') await store.add('prepGuides', { ...form, applicationId: Number(form.applicationId) || null })
    else await store.put('prepGuides', form)
    setEditing(null); setForm(null); load()
  }

  async function remove(id) { if (confirm('Delete this prep guide?')) { await store.delete('prepGuides', id); load() } }

  function appName(id) {
    const a = apps.find(x => x.id === id)
    return a ? `${a.company} — ${a.role}` : 'Unlinked'
  }

  if (form) return (
    <div className="card max-w-2xl space-y-3">
      <h2 className="text-sm font-semibold">{editing === 'new' ? 'New Prep Guide' : 'Edit Prep Guide'}</h2>
      <form onSubmit={save} className="space-y-3">
        <div>
          <label>Linked Application</label>
          <select value={form.applicationId} onChange={e => setForm(f => ({ ...f, applicationId: e.target.value }))}>
            <option value="">— None —</option>
            {apps.map(a => <option key={a.id} value={a.id}>{a.company} — {a.role}</option>)}
          </select>
        </div>
        <div><label>Company Research</label><textarea rows={3} value={form.companyResearch} onChange={e => setForm(f => ({ ...f, companyResearch: e.target.value }))} placeholder="Mission, culture, recent news, team..." /></div>
        <div><label>Role-Specific Talking Points</label><textarea rows={3} value={form.talkingPoints} onChange={e => setForm(f => ({ ...f, talkingPoints: e.target.value }))} placeholder="Key experiences to highlight..." /></div>
        <div><label>Anticipated Questions</label><textarea rows={3} value={form.anticipatedQuestions} onChange={e => setForm(f => ({ ...f, anticipatedQuestions: e.target.value }))} placeholder="Likely behavioral/technical questions..." /></div>
        <div><label>Story Bank Links</label><textarea rows={2} value={form.storyBankLinks} onChange={e => setForm(f => ({ ...f, storyBankLinks: e.target.value }))} placeholder="Links to STAR stories, docs..." /></div>
        <div className="flex gap-2 pt-2 border-t border-border">
          <button type="submit" className="primary">Save</button>
          <button type="button" onClick={() => { setEditing(null); setForm(null) }}>Cancel</button>
        </div>
      </form>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Prep Library</h2>
        <button className="primary" onClick={startNew}>+ New Guide</button>
      </div>
      {guides.length === 0 && <p className="text-muted text-xs text-center py-8">No prep guides yet. Create one to start preparing.</p>}
      {guides.map(g => (
        <div key={g.id} className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <strong className="text-xs">{appName(g.applicationId)}</strong>
              {g.companyResearch && <p className="text-[11px] text-muted mt-0.5 line-clamp-2">{g.companyResearch.slice(0, 100)}{g.companyResearch.length > 100 ? '...' : ''}</p>}
            </div>
            <div className="flex gap-1">
              <button className="border-transparent bg-transparent hover:bg-bg-secondary" onClick={() => startEdit(g)}>✏️</button>
              <button className="border-transparent bg-transparent hover:bg-bg-secondary text-danger" onClick={() => remove(g.id)}>🗑</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
