import { useState, useEffect, useRef } from 'react'
import { store } from '../../lib/store'
import { exportApplicationPDF } from '../../lib/pdf'
import { STATUSES, SOURCES } from '../../lib/constants'
import { format } from 'date-fns'

const STATUS_COLORS = {
  'Wishlist': ['#6b7280', '#f3f4f6'],
  'Applied': ['#2563eb', '#dbeafe'],
  'Referred': ['#7c3aed', '#ede9fe'],
  'Recruiter Screen Scheduled': ['#0891b2', '#cffafe'],
  'Recruiter Screen Done': ['#0d9488', '#ccfbf1'],
  'Interview Scheduled': ['#4f46e5', '#e0e7ff'],
  'Interview In Progress': ['#7c3aed', '#ede9fe'],
  'Offer': ['#059669', '#d1fae5'],
  'Offer Negotiation': ['#d97706', '#fef3c7'],
  'Accepted': ['#15803d', '#bbf7d0'],
  'Rejected': ['#dc2626', '#fee2e2'],
  'Withdrawn': ['#475569', '#f1f5f9'],
  'Ghosted': ['#ea580c', '#ffedd5'],
}

function StatusPill({ status, size = 'sm' }) {
  const [color, bg] = STATUS_COLORS[status] || ['#6b7280', '#f3f4f6']
  const cls = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1'
  return <span className={`inline-flex items-center rounded-full font-semibold ${cls}`} style={{ color, backgroundColor: bg }}>{status}</span>
}

const emptyApp = { company: '', role: '', jdLink: '', jdText: '', dateApplied: new Date().toISOString().slice(0, 10), status: 'Wishlist', source: '', contactName: '', contactEmail: '', salaryMin: '', salaryMax: '', notes: '', tags: [], statusHistory: [] }

export default function ApplicationDrawer({ id, onClose, onSaved }) {
  const [form, setForm] = useState(emptyApp)
  const [tagInput, setTagInput] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [resumes, setResumes] = useState([])
  const [section, setSection] = useState('all')
  const [resumeFile, setResumeFile] = useState(null)
  const [resumeName, setResumeName] = useState('')
  const [resumeCategory, setResumeCategory] = useState('General')
  const fileRef = useRef()

  useEffect(() => {
    if (id !== 'new') store.get('applications', id).then(a => a && setForm({ ...emptyApp, ...a, statusHistory: a.statusHistory || [] }))
    store.getAll('resumes').then(setResumes)
  }, [id])

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  function addTag() {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t] }))
    setTagInput('')
  }

  function changeStatus(toStatus) {
    if (!toStatus || toStatus === form.status) return
    const entry = { fromStatus: form.status, toStatus, timestamp: new Date().toISOString(), note: statusNote || undefined }
    setForm(f => ({ ...f, status: toStatus, statusHistory: [...f.statusHistory, entry] }))
    setNewStatus('')
    setStatusNote('')
  }

  async function toggleResumeLink(resumeId) {
    if (id === 'new') return
    const resume = resumes.find(r => r.id === resumeId)
    const linked = resume.linkedApps || []
    const updated = linked.includes(id) ? linked.filter(x => x !== id) : [...linked, id]
    await store.put('resumes', { ...resume, linkedApps: updated })
    setResumes(await store.getAll('resumes'))
  }

  async function uploadResume() {
    if (!resumeFile || !resumeName.trim()) return
    const reader = new FileReader()
    reader.onload = async () => {
      const newResume = { name: resumeName.trim(), category: resumeCategory, fileName: resumeFile.name, type: resumeFile.type, data: reader.result, linkedApps: id !== 'new' ? [id] : [], createdAt: new Date().toISOString() }
      await store.add('resumes', newResume)
      setResumes(await store.getAll('resumes'))
      setResumeFile(null); setResumeName(''); setResumeCategory('General')
    }
    reader.readAsDataURL(resumeFile)
  }

  async function save(e) {
    e.preventDefault()
    const record = { ...form, salaryMin: Number(form.salaryMin) || null, salaryMax: Number(form.salaryMax) || null }
    if (id === 'new') {
      if (!record.statusHistory.length) {
        record.statusHistory = [{ fromStatus: null, toStatus: record.status, timestamp: new Date().toISOString(), note: 'Created' }]
      }
      await store.add('applications', record)
    } else {
      await store.put('applications', record)
    }
    onSaved()
  }

  async function remove() {
    if (id !== 'new' && confirm('Delete this application?')) {
      await store.delete('applications', id)
      onSaved()
    }
  }

  const linkedResumes = resumes.filter(r => (r.linkedApps || []).includes(id))
  const availableResumes = resumes.filter(r => !(r.linkedApps || []).includes(id))

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Drawer */}
      <div className="relative w-full max-w-[520px] h-full bg-bg-card shadow-2xl flex flex-col animate-[slideIn_0.2s_ease]" onClick={e => e.stopPropagation()}>

        {/* ─── Header ─── */}
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted font-medium mb-1">{id === 'new' ? 'New Application' : 'Edit Application'}</p>
              <h2 className="text-base font-bold leading-tight">
                {form.company || 'Company'} <span className="text-muted font-normal">· {form.role || 'Role'}</span>
              </h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full border-0 bg-bg-secondary hover:bg-border text-muted text-sm">✕</button>
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            <StatusPill status={form.status} size="md" />
            {form.source && <span className="text-[10px] text-muted bg-bg-secondary px-2 py-0.5 rounded-full font-medium">{form.source}</span>}
            {form.dateApplied && <span className="text-[10px] text-muted ml-auto">{format(new Date(form.dateApplied), 'MMM d, yyyy')}</span>}
          </div>
        </div>

        {/* ─── Scrollable Content ─── */}
        <div className="flex-1 overflow-y-auto">
          <form id="app-form" onSubmit={save}>

            {/* ── Section: Core Info ── */}
            <div className="px-5 py-4 space-y-3 border-b border-border">
              <div className="grid grid-cols-2 gap-3">
                <div><label>Company *</label><input required value={form.company} onChange={set('company')} placeholder="Acme Inc." /></div>
                <div><label>Role *</label><input required value={form.role} onChange={set('role')} placeholder="Sr. Engineer" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label>Status</label>
                  {id === 'new'
                    ? <select value={form.status} onChange={set('status')}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
                    : <StatusPill status={form.status} />
                  }
                </div>
                <div><label>Source</label><select value={form.source} onChange={set('source')}><option value="">—</option>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label>Date Applied</label><input type="date" value={form.dateApplied} onChange={set('dateApplied')} /></div>
              </div>
            </div>

            {/* ── Section: Status Change (edit only) ── */}
            {id !== 'new' && <div className="px-5 py-4 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <label className="mb-0">Change Status</label>
                {newStatus && <button type="button" className="text-[10px] text-danger border-0 bg-transparent p-0" onClick={() => setNewStatus('')}>Cancel</button>}
              </div>
              {!newStatus ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {STATUSES.filter(s => s !== form.status).slice(0, 6).map(s => (
                    <button key={s} type="button" onClick={() => setNewStatus(s)} className="border-0 bg-transparent p-0">
                      <StatusPill status={s} />
                    </button>
                  ))}
                  <button type="button" onClick={() => setSection(section === 'allStatuses' ? 'all' : 'allStatuses')} className="text-[10px] text-accent border-0 bg-transparent">
                    {section === 'allStatuses' ? 'Less ▲' : 'More ▼'}
                  </button>
                </div>
              ) : (
                <div className="bg-bg-secondary rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <StatusPill status={form.status} />
                    <span className="text-muted text-xs">→</span>
                    <StatusPill status={newStatus} />
                  </div>
                  <input placeholder="Add a note (optional)..." value={statusNote} onChange={e => setStatusNote(e.target.value)} />
                  <button type="button" className="primary w-full" onClick={() => changeStatus(newStatus)}>Confirm Change</button>
                </div>
              )}
              {section === 'allStatuses' && !newStatus && (
                <div className="grid grid-cols-3 gap-1.5 mt-2 pt-2 border-t border-border">
                  {STATUSES.filter(s => s !== form.status).slice(6).map(s => (
                    <button key={s} type="button" onClick={() => setNewStatus(s)} className="border-0 bg-transparent p-0">
                      <StatusPill status={s} />
                    </button>
                  ))}
                </div>
              )}
            </div>}

            {/* ── Section: Details ── */}
            <div className="px-5 py-4 space-y-3 border-b border-border">
              <div className="grid grid-cols-2 gap-3">
                <div><label>Salary Min</label><input type="number" placeholder="100000" value={form.salaryMin} onChange={set('salaryMin')} /></div>
                <div><label>Salary Max</label><input type="number" placeholder="150000" value={form.salaryMax} onChange={set('salaryMax')} /></div>
              </div>
              <div><label>JD Link</label><input value={form.jdLink} onChange={set('jdLink')} placeholder="https://..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label>Contact Name</label><input value={form.contactName} onChange={set('contactName')} placeholder="Hiring Manager" /></div>
                <div><label>Contact Email</label><input type="email" value={form.contactEmail} onChange={set('contactEmail')} /></div>
              </div>
              <div><label>Notes</label><textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Context, motivation, red flags..." /></div>
            </div>

            {/* ── Section: Tags ── */}
            <div className="px-5 py-4 border-b border-border">
              <label>Tags <span className="font-normal normal-case tracking-normal text-muted">— categorize for filtering (e.g. remote, FAANG, visa-ok)</span></label>
              <div className="flex gap-1.5">
                <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Type & Enter" className="flex-1" />
                <button type="button" onClick={addTag} className="px-3 shrink-0">+</button>
              </div>
              {form.tags.length > 0 && <div className="flex gap-1.5 flex-wrap mt-2">
                {form.tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full cursor-pointer transition-colors bg-accent/10 text-accent hover:bg-red-100 hover:text-red-600" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))}>
                    {t} <span className="opacity-60">✕</span>
                  </span>
                ))}
              </div>}
            </div>

            {/* ── Section: Resumes ── */}
            <div className="px-5 py-4 border-b border-border">
              <label>Resume</label>

              {/* Linked resumes */}
              {linkedResumes.length > 0 && <div className="space-y-1.5 mb-2">
                {linkedResumes.map(r => (
                  <div key={r.id} className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: 'rgba(99,102,241,0.06)' }}>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${r.category === 'Tailored' ? 'bg-purple-50 text-purple-700' : 'bg-sky-50 text-sky-700'}`}>{r.category === 'Tailored' ? '🎯' : '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{r.name}</p>
                      <p className="text-[10px] text-muted">{r.fileName}</p>
                    </div>
                    {id !== 'new' && <button type="button" onClick={() => toggleResumeLink(r.id)} className="text-[10px] text-danger border-0 bg-transparent hover:underline px-0">Unlink</button>}
                  </div>
                ))}
              </div>}

              {/* Link existing */}
              {id !== 'new' && availableResumes.length > 0 && <div className="mb-2">
                <p className="text-[10px] text-muted mb-1">Link existing resume:</p>
                <div className="flex flex-wrap gap-1">
                  {availableResumes.map(r => (
                    <button key={r.id} type="button" onClick={() => toggleResumeLink(r.id)} className="text-[10px] px-2 py-1 rounded-md bg-bg-secondary border-0 hover:bg-accent/10 hover:text-accent">
                      📎 {r.name}
                    </button>
                  ))}
                </div>
              </div>}

              {/* Upload new */}
              <div className="bg-bg-secondary rounded-lg p-3 space-y-2">
                <p className="text-[10px] text-muted font-medium uppercase tracking-wide">Upload New Resume</p>
                <input placeholder="Version name (e.g. SDE-v2-AWS)" value={resumeName} onChange={e => setResumeName(e.target.value)} />
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setResumeCategory('General')} className={`flex-1 text-[10px] py-1 rounded-md border ${resumeCategory === 'General' ? 'bg-sky-50 text-sky-700 border-sky-200 font-semibold' : 'bg-transparent text-muted border-border'}`}>📋 General</button>
                  <button type="button" onClick={() => setResumeCategory('Tailored')} className={`flex-1 text-[10px] py-1 rounded-md border ${resumeCategory === 'Tailored' ? 'bg-purple-50 text-purple-700 border-purple-200 font-semibold' : 'bg-transparent text-muted border-border'}`}>🎯 Tailored</button>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex-1 text-[11px] border-dashed border-border">
                    {resumeFile ? `📎 ${resumeFile.name}` : '📁 Choose file (PDF/DOCX)'}
                  </button>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={e => setResumeFile(e.target.files[0])} />
                  {resumeFile && resumeName && <button type="button" className="primary text-[11px] px-3" onClick={uploadResume}>Upload</button>}
                </div>
              </div>
            </div>

            {/* ── Section: Status History ── */}
            {form.statusHistory.length > 0 && <div className="px-5 py-4">
              <label>Timeline</label>
              <div className="relative pl-4 space-y-2">
                <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
                {[...form.statusHistory].reverse().map((h, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 border-bg-card" style={{ backgroundColor: (STATUS_COLORS[h.toStatus] || ['#6b7280'])[0] }} />
                    <div className="pl-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {h.fromStatus && <><StatusPill status={h.fromStatus} /><span className="text-muted text-[10px]">→</span></>}
                        <StatusPill status={h.toStatus} />
                        <span className="text-[10px] text-muted ml-auto">{format(new Date(h.timestamp), 'MMM d · HH:mm')}</span>
                      </div>
                      {h.note && <p className="text-[11px] text-muted mt-0.5 italic">"{h.note}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>}

          </form>
        </div>

        {/* ─── Footer ─── */}
        <div className="shrink-0 px-5 py-3 border-t border-border bg-bg-card flex items-center gap-2">
          <button type="submit" form="app-form" className="primary flex-1 py-2">
            {id === 'new' ? '🚀 Create Application' : '💾 Save Changes'}
          </button>
          {id !== 'new' && <button type="button" onClick={() => exportApplicationPDF(id)} title="Export PDF" className="px-2.5">📄</button>}
          {id !== 'new' && <button type="button" className="danger px-2.5" onClick={remove} title="Delete">🗑</button>}
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  )
}
