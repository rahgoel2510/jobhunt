import { useState, useEffect, useRef } from 'react'
import { store } from '../../lib/store'
import { exportApplicationPDF } from '../../lib/pdf'
import { STATUSES, SOURCES } from '../../lib/constants'
import { format } from 'date-fns'
import CompanyLogo from '../shared/CompanyLogo'

const STATUS_COLORS = {
  'Wishlist': ['#6b7280', '#f3f4f6'], 'Applied': ['#2563eb', '#dbeafe'],
  'Referred': ['#7c3aed', '#ede9fe'], 'Recruiter Screen Scheduled': ['#0891b2', '#cffafe'],
  'Recruiter Screen Done': ['#0d9488', '#ccfbf1'], 'Interview Scheduled': ['#4f46e5', '#e0e7ff'],
  'Interview In Progress': ['#7c3aed', '#ede9fe'], 'Offer': ['#059669', '#d1fae5'],
  'Offer Negotiation': ['#d97706', '#fef3c7'], 'Accepted': ['#15803d', '#bbf7d0'],
  'Rejected': ['#dc2626', '#fee2e2'], 'Withdrawn': ['#475569', '#f1f5f9'],
  'Ghosted': ['#ea580c', '#ffedd5'],
}

const ROUND_TYPES = ['Phone Screen', 'Technical', 'System Design', 'Behavioral', 'Hiring Manager', 'Panel', 'Bar Raiser', 'Final', 'Other']
const ROUND_RESULT = ['Pending', 'Passed', 'Failed', 'No Feedback']
const RESULT_COLORS = { Pending: 'bg-amber-50 text-amber-700', Passed: 'bg-green-50 text-green-700', Failed: 'bg-red-50 text-red-700', 'No Feedback': 'bg-gray-100 text-gray-600' }

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
  const [rounds, setRounds] = useState([])
  const [retros, setRetros] = useState([])
  const [addingRound, setAddingRound] = useState(false)
  const [roundForm, setRoundForm] = useState(null)
  const [editingRetro, setEditingRetro] = useState(null)
  const [retroForm, setRetroForm] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    if (id !== 'new') {
      store.get('applications', id).then(a => a && setForm({ ...emptyApp, ...a, statusHistory: a.statusHistory || [] }))
      loadRounds()
    }
    store.getAll('resumes').then(setResumes)
  }, [id])

  async function loadRounds() {
    const allRounds = await store.getAll('interviewRounds')
    const appRounds = allRounds.filter(r => r.applicationId === id).sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0))
    setRounds(appRounds)
    const allRetros = await store.getAll('retrospectives')
    setRetros(allRetros.filter(r => r.applicationId === id))
  }

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
    setNewStatus(''); setStatusNote('')
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
      await store.add('resumes', { name: resumeName.trim(), category: resumeCategory, fileName: resumeFile.name, type: resumeFile.type, data: reader.result, linkedApps: id !== 'new' ? [id] : [], createdAt: new Date().toISOString() })
      setResumes(await store.getAll('resumes'))
      setResumeFile(null); setResumeName(''); setResumeCategory('General')
    }
    reader.readAsDataURL(resumeFile)
  }

  async function saveRound() {
    if (!roundForm) return
    const record = { ...roundForm, applicationId: id, roundNumber: rounds.length + 1 }
    if (roundForm.id) await store.put('interviewRounds', record)
    else await store.add('interviewRounds', record)
    setAddingRound(false); setRoundForm(null); loadRounds()
  }

  async function deleteRound(roundId) {
    if (!confirm('Delete this round?')) return
    await store.delete('interviewRounds', roundId)
    const retro = retros.find(r => r.roundId === roundId)
    if (retro) await store.delete('retrospectives', retro.id)
    loadRounds()
  }

  async function saveRetro() {
    if (!retroForm) return
    if (retroForm.id) await store.put('retrospectives', retroForm)
    else await store.add('retrospectives', retroForm)
    setEditingRetro(null); setRetroForm(null); loadRounds()
  }

  function startRetro(round) {
    const existing = retros.find(r => r.roundId === round.id)
    if (existing) { setRetroForm(existing); setEditingRetro(round.id) }
    else { setRetroForm({ roundId: round.id, applicationId: id, wentWell: '', wentPoorly: '', learned: '', confidence: 3 }); setEditingRetro(round.id) }
  }

  async function save(e) {
    e.preventDefault()
    const record = { ...form, salaryMin: Number(form.salaryMin) || null, salaryMax: Number(form.salaryMax) || null }
    if (id === 'new') {
      if (!record.statusHistory.length) record.statusHistory = [{ fromStatus: null, toStatus: record.status, timestamp: new Date().toISOString(), note: 'Created' }]
      await store.add('applications', record)
    } else await store.put('applications', record)
    onSaved()
  }

  async function remove() {
    if (id !== 'new' && confirm('Delete this application?')) { await store.delete('applications', id); onSaved() }
  }

  const linkedResumes = resumes.filter(r => (r.linkedApps || []).includes(id))
  const availableResumes = resumes.filter(r => !(r.linkedApps || []).includes(id))
  const isInterviewPhase = ['Interview Scheduled', 'Interview In Progress', 'Recruiter Screen Scheduled', 'Recruiter Screen Done'].includes(form.status)

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-[520px] h-full bg-bg-card shadow-2xl flex flex-col animate-[slideIn_0.2s_ease]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <CompanyLogo company={form.company} size={40} />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted font-medium mb-0.5">{id === 'new' ? 'New Application' : 'Edit Application'}</p>
                <h2 className="text-base font-bold leading-tight">{form.company || 'Company'} <span className="text-muted font-normal">· {form.role || 'Role'}</span></h2>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full border-0 bg-bg-secondary hover:bg-border text-muted text-sm">✕</button>
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            <StatusPill status={form.status} size="md" />
            {form.source && <span className="text-[10px] text-muted bg-bg-secondary px-2 py-0.5 rounded-full font-medium">{form.source}</span>}
            {rounds.length > 0 && <span className="text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded-full font-medium">{rounds.length} round{rounds.length > 1 ? 's' : ''}</span>}
            {form.dateApplied && <span className="text-[10px] text-muted ml-auto">{format(new Date(form.dateApplied), 'MMM d, yyyy')}</span>}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <form id="app-form" onSubmit={save}>

            {/* Core Info */}
            <div className="px-5 py-4 space-y-3 border-b border-border">
              <div className="grid grid-cols-2 gap-3">
                <div><label>Company *</label><input required value={form.company} onChange={set('company')} placeholder="Acme Inc." /></div>
                <div><label>Role *</label><input required value={form.role} onChange={set('role')} placeholder="Sr. Engineer" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label>Status</label>{id === 'new' ? <select value={form.status} onChange={set('status')}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select> : <StatusPill status={form.status} />}</div>
                <div><label>Source</label><select value={form.source} onChange={set('source')}><option value="">—</option>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label>Date Applied</label><input type="date" value={form.dateApplied} onChange={set('dateApplied')} /></div>
              </div>
            </div>

            {/* Status Change */}
            {id !== 'new' && <div className="px-5 py-4 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <label className="mb-0">Change Status</label>
                {newStatus && <button type="button" className="text-[10px] text-danger border-0 bg-transparent p-0" onClick={() => setNewStatus('')}>Cancel</button>}
              </div>
              {!newStatus ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {STATUSES.filter(s => s !== form.status).slice(0, 6).map(s => (
                    <button key={s} type="button" onClick={() => setNewStatus(s)} className="border-0 bg-transparent p-0"><StatusPill status={s} /></button>
                  ))}
                  <button type="button" onClick={() => setSection(section === 'allStatuses' ? 'all' : 'allStatuses')} className="text-[10px] text-accent border-0 bg-transparent">{section === 'allStatuses' ? 'Less ▲' : 'More ▼'}</button>
                </div>
              ) : (
                <div className="bg-bg-secondary rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2"><StatusPill status={form.status} /><span className="text-muted text-xs">→</span><StatusPill status={newStatus} /></div>
                  <input placeholder="Add a note (optional)..." value={statusNote} onChange={e => setStatusNote(e.target.value)} />
                  <button type="button" className="primary w-full" onClick={() => changeStatus(newStatus)}>Confirm Change</button>
                </div>
              )}
              {section === 'allStatuses' && !newStatus && (
                <div className="grid grid-cols-3 gap-1.5 mt-2 pt-2 border-t border-border">
                  {STATUSES.filter(s => s !== form.status).slice(6).map(s => (
                    <button key={s} type="button" onClick={() => setNewStatus(s)} className="border-0 bg-transparent p-0"><StatusPill status={s} /></button>
                  ))}
                </div>
              )}
            </div>}

            {/* ═══ Interview Rounds Pipeline ═══ */}
            {id !== 'new' && (isInterviewPhase || rounds.length > 0) && <div className="px-5 py-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <label className="mb-0 flex items-center gap-1.5">🎯 Interview Pipeline <span className="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full font-bold">{rounds.length}</span></label>
                <button type="button" className="text-[10px] text-accent border-0 bg-transparent p-0 font-semibold" onClick={() => { setAddingRound(true); setRoundForm({ type: 'Technical', date: new Date().toISOString().slice(0, 10), interviewer: '', result: 'Pending', notes: '' }) }}>+ Add Round</button>
              </div>

              {/* Round list */}
              <div className="space-y-2">
                {rounds.map((r, i) => {
                  const retro = retros.find(rt => rt.roundId === r.id)
                  const isEditingThisRetro = editingRetro === r.id
                  return (
                    <div key={r.id} className="rounded-lg border border-border overflow-hidden">
                      {/* Round header */}
                      <div className="flex items-center gap-2 p-2.5 bg-bg-secondary/50">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: (STATUS_COLORS['Interview In Progress'] || ['#7c3aed'])[0] }}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold">{r.type}</p>
                          <p className="text-[10px] text-muted">{r.date ? format(new Date(r.date), 'MMM d, yyyy') : ''}{r.interviewer ? ` · ${r.interviewer}` : ''}</p>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${RESULT_COLORS[r.result] || RESULT_COLORS.Pending}`}>{r.result || 'Pending'}</span>
                        <button type="button" onClick={() => startRetro(r)} className="text-[10px] border-0 bg-transparent text-accent p-0">{retro ? '📝' : '➕'}</button>
                        <button type="button" onClick={() => deleteRound(r.id)} className="text-[10px] border-0 bg-transparent text-danger p-0">✕</button>
                      </div>

                      {/* Round notes */}
                      {r.notes && <p className="px-2.5 py-1.5 text-[10px] text-muted border-t border-border">{r.notes}</p>}

                      {/* Retro inline */}
                      {retro && !isEditingThisRetro && <div className="px-2.5 py-2 border-t border-border bg-green-50/30 space-y-0.5">
                        <p className="text-[10px]"><strong className="text-green-700">✓ Well:</strong> {retro.wentWell}</p>
                        <p className="text-[10px]"><strong className="text-red-600">✗ Poorly:</strong> {retro.wentPoorly}</p>
                        {retro.learned && <p className="text-[10px]"><strong className="text-blue-600">💡 Learned:</strong> {retro.learned}</p>}
                        <p className="text-[10px] text-muted">Confidence: {'★'.repeat(retro.confidence)}{'☆'.repeat(5 - retro.confidence)}</p>
                      </div>}

                      {/* Retro edit form */}
                      {isEditingThisRetro && <div className="px-2.5 py-2.5 border-t border-border space-y-2 bg-bg-secondary/30">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Retrospective — Round {i + 1}</p>
                        <div><label className="text-[9px]">What went well?</label><textarea rows={2} value={retroForm?.wentWell || ''} onChange={e => setRetroForm(f => ({ ...f, wentWell: e.target.value }))} /></div>
                        <div><label className="text-[9px]">What went poorly?</label><textarea rows={2} value={retroForm?.wentPoorly || ''} onChange={e => setRetroForm(f => ({ ...f, wentPoorly: e.target.value }))} /></div>
                        <div><label className="text-[9px]">Key learning</label><input value={retroForm?.learned || ''} onChange={e => setRetroForm(f => ({ ...f, learned: e.target.value }))} /></div>
                        <div>
                          <label className="text-[9px]">Confidence: {retroForm?.confidence || 3}/5</label>
                          <div className="flex gap-1 mt-0.5">
                            {[1, 2, 3, 4, 5].map(n => (
                              <button key={n} type="button" onClick={() => setRetroForm(f => ({ ...f, confidence: n }))} className={`w-7 h-7 rounded border-0 text-sm ${n <= (retroForm?.confidence || 3) ? 'bg-amber-400 text-white' : 'bg-bg-secondary text-muted'}`}>★</button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button type="button" className="primary text-[10px] flex-1" onClick={saveRetro}>Save Retro</button>
                          <button type="button" className="text-[10px]" onClick={() => { setEditingRetro(null); setRetroForm(null) }}>Cancel</button>
                        </div>
                      </div>}
                    </div>
                  )
                })}
              </div>

              {/* Add round form */}
              {addingRound && roundForm && <div className="mt-2 rounded-lg border border-accent/30 p-3 space-y-2 bg-accent/5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">New Round #{rounds.length + 1}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[9px]">Type</label><select value={roundForm.type} onChange={e => setRoundForm(f => ({ ...f, type: e.target.value }))}>{ROUND_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                  <div><label className="text-[9px]">Date</label><input type="date" value={roundForm.date} onChange={e => setRoundForm(f => ({ ...f, date: e.target.value }))} /></div>
                </div>
                <div><label className="text-[9px]">Interviewer(s)</label><input value={roundForm.interviewer} onChange={e => setRoundForm(f => ({ ...f, interviewer: e.target.value }))} placeholder="Jane (Sr Eng), Bob (HM)" /></div>
                <div><label className="text-[9px]">Result</label>
                  <div className="flex gap-1">
                    {ROUND_RESULT.map(r => (
                      <button key={r} type="button" onClick={() => setRoundForm(f => ({ ...f, result: r }))} className={`flex-1 text-[9px] py-1 rounded border ${roundForm.result === r ? RESULT_COLORS[r] + ' border-current font-bold' : 'bg-transparent text-muted border-border'}`}>{r}</button>
                    ))}
                  </div>
                </div>
                <div><label className="text-[9px]">Notes</label><input value={roundForm.notes} onChange={e => setRoundForm(f => ({ ...f, notes: e.target.value }))} placeholder="Topics, format, duration..." /></div>
                <div className="flex gap-1.5">
                  <button type="button" className="primary text-[10px] flex-1" onClick={saveRound}>Add Round</button>
                  <button type="button" className="text-[10px]" onClick={() => { setAddingRound(false); setRoundForm(null) }}>Cancel</button>
                </div>
              </div>}

              {rounds.length === 0 && !addingRound && <p className="text-[10px] text-muted text-center py-3">No rounds yet. Add your first interview round.</p>}
            </div>}

            {/* Details */}
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

            {/* Tags */}
            <div className="px-5 py-4 border-b border-border">
              <label>Tags <span className="font-normal normal-case tracking-normal text-muted">— e.g. remote, FAANG, visa-ok</span></label>
              <div className="flex gap-1.5">
                <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Type & Enter" className="flex-1" />
                <button type="button" onClick={addTag} className="px-3 shrink-0">+</button>
              </div>
              {form.tags.length > 0 && <div className="flex gap-1.5 flex-wrap mt-2">
                {form.tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full cursor-pointer bg-accent/10 text-accent hover:bg-red-100 hover:text-red-600" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))}>{t} ✕</span>
                ))}
              </div>}
            </div>

            {/* Resumes */}
            <div className="px-5 py-4 border-b border-border">
              <label>Resume</label>
              {linkedResumes.length > 0 && <div className="space-y-1.5 mb-2">
                {linkedResumes.map(r => (
                  <div key={r.id} className="flex items-center gap-2 rounded-lg p-2 bg-accent/5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${r.category === 'Tailored' ? 'bg-purple-50 text-purple-700' : 'bg-sky-50 text-sky-700'}`}>{r.category === 'Tailored' ? '🎯' : '📋'}</span>
                    <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{r.name}</p><p className="text-[10px] text-muted">{r.fileName}</p></div>
                    {id !== 'new' && <button type="button" onClick={() => toggleResumeLink(r.id)} className="text-[10px] text-danger border-0 bg-transparent px-0">Unlink</button>}
                  </div>
                ))}
              </div>}
              {id !== 'new' && availableResumes.length > 0 && <div className="mb-2"><p className="text-[10px] text-muted mb-1">Link existing:</p><div className="flex flex-wrap gap-1">{availableResumes.map(r => (<button key={r.id} type="button" onClick={() => toggleResumeLink(r.id)} className="text-[10px] px-2 py-1 rounded-md bg-bg-secondary border-0 hover:bg-accent/10 hover:text-accent">📎 {r.name}</button>))}</div></div>}
              <div className="bg-bg-secondary rounded-lg p-3 space-y-2">
                <p className="text-[10px] text-muted font-medium uppercase tracking-wide">Upload New</p>
                <input placeholder="Version name" value={resumeName} onChange={e => setResumeName(e.target.value)} />
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setResumeCategory('General')} className={`flex-1 text-[10px] py-1 rounded-md border ${resumeCategory === 'General' ? 'bg-sky-50 text-sky-700 border-sky-200 font-semibold' : 'bg-transparent text-muted border-border'}`}>📋 General</button>
                  <button type="button" onClick={() => setResumeCategory('Tailored')} className={`flex-1 text-[10px] py-1 rounded-md border ${resumeCategory === 'Tailored' ? 'bg-purple-50 text-purple-700 border-purple-200 font-semibold' : 'bg-transparent text-muted border-border'}`}>🎯 Tailored</button>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex-1 text-[11px] border-dashed border-border">{resumeFile ? `📎 ${resumeFile.name}` : '📁 Choose file'}</button>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={e => setResumeFile(e.target.files[0])} />
                  {resumeFile && resumeName && <button type="button" className="primary text-[11px] px-3" onClick={uploadResume}>Upload</button>}
                </div>
              </div>
            </div>

            {/* Status History */}
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

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-border bg-bg-card flex items-center gap-2">
          <button type="submit" form="app-form" className="primary flex-1 py-2">{id === 'new' ? '🚀 Create Application' : '💾 Save Changes'}</button>
          {id !== 'new' && <button type="button" onClick={() => exportApplicationPDF(id)} title="Export PDF" className="px-2.5">📄</button>}
          {id !== 'new' && <button type="button" className="danger px-2.5" onClick={remove} title="Delete">🗑</button>}
        </div>
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </div>
  )
}
