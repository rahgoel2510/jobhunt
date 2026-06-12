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

function StatusPill({ status }) {
  const [color, bg] = STATUS_COLORS[status] || ['#6b7280', '#f3f4f6']
  return <span className="inline-flex items-center rounded-full font-semibold text-[10px] px-2 py-0.5" style={{ color, backgroundColor: bg }}>{status}</span>
}

const WORKFLOW_STEPS = [
  { id: 'info', icon: '📋', label: 'Info' },
  { id: 'prep', icon: '📚', label: 'Prep' },
  { id: 'interviews', icon: '🎯', label: 'Interviews' },
  { id: 'outcome', icon: '🏁', label: 'Outcome' },
]

const emptyApp = { company: '', role: '', jdLink: '', jdText: '', dateApplied: new Date().toISOString().slice(0, 10), status: 'Wishlist', source: '', contactName: '', contactEmail: '', salaryMin: '', salaryMax: '', notes: '', tags: [], statusHistory: [] }

export default function ApplicationDrawer({ id, onClose, onSaved }) {
  const [form, setForm] = useState(emptyApp)
  const [step, setStep] = useState('info')
  const [tagInput, setTagInput] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [resumes, setResumes] = useState([])
  const [resumeFile, setResumeFile] = useState(null)
  const [resumeName, setResumeName] = useState('')
  const [resumeCategory, setResumeCategory] = useState('General')
  const [rounds, setRounds] = useState([])
  const [retros, setRetros] = useState([])
  const [roundForm, setRoundForm] = useState(null)
  const [editingRetro, setEditingRetro] = useState(null)
  const [retroForm, setRetroForm] = useState(null)
  const [prep, setPrep] = useState(null)
  const [editingPrep, setEditingPrep] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (id !== 'new') { store.get('applications', id).then(a => a && setForm({ ...emptyApp, ...a, statusHistory: a.statusHistory || [] })); loadData() }
    store.getAll('resumes').then(setResumes)
  }, [id])

  async function loadData() {
    const [allRounds, allRetros, allPreps] = await Promise.all([store.getAll('interviewRounds'), store.getAll('retrospectives'), store.getAll('prepGuides')])
    setRounds(allRounds.filter(r => r.applicationId === id).sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0)))
    setRetros(allRetros.filter(r => r.applicationId === id))
    setPrep(allPreps.find(p => p.applicationId === id) || null)
  }

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }
  function addTag() { const t = tagInput.trim(); if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t] })); setTagInput('') }
  function changeStatus(toStatus) {
    if (!toStatus || toStatus === form.status) return
    setForm(f => ({ ...f, status: toStatus, statusHistory: [...f.statusHistory, { fromStatus: f.status, toStatus, timestamp: new Date().toISOString(), note: statusNote || undefined }] }))
    setNewStatus(''); setStatusNote('')
  }
  async function toggleResumeLink(resumeId) {
    if (id === 'new') return
    const r = resumes.find(x => x.id === resumeId); const linked = r.linkedApps || []
    await store.put('resumes', { ...r, linkedApps: linked.includes(id) ? linked.filter(x => x !== id) : [...linked, id] })
    setResumes(await store.getAll('resumes'))
  }
  async function uploadResume() {
    if (!resumeFile || !resumeName.trim()) return
    const reader = new FileReader()
    reader.onload = async () => { await store.add('resumes', { name: resumeName.trim(), category: resumeCategory, fileName: resumeFile.name, type: resumeFile.type, data: reader.result, linkedApps: id !== 'new' ? [id] : [], createdAt: new Date().toISOString() }); setResumes(await store.getAll('resumes')); setResumeFile(null); setResumeName(''); setResumeCategory('General') }
    reader.readAsDataURL(resumeFile)
  }
  async function saveRound() { if (!roundForm) return; const rec = { ...roundForm, applicationId: id, roundNumber: rounds.length + 1 }; if (roundForm.id) await store.put('interviewRounds', rec); else await store.add('interviewRounds', rec); setRoundForm(null); loadData() }
  async function deleteRound(rid) { if (!confirm('Delete?')) return; await store.delete('interviewRounds', rid); const rt = retros.find(r => r.roundId === rid); if (rt) await store.delete('retrospectives', rt.id); loadData() }
  async function saveRetro() { if (!retroForm) return; if (retroForm.id) await store.put('retrospectives', retroForm); else await store.add('retrospectives', retroForm); setEditingRetro(null); setRetroForm(null); loadData() }
  function startRetro(round) { const existing = retros.find(r => r.roundId === round.id); setRetroForm(existing || { roundId: round.id, applicationId: id, wentWell: '', wentPoorly: '', learned: '', confidence: 3 }); setEditingRetro(round.id) }
  async function savePrep() { if (!prep) return; if (prep.id) await store.put('prepGuides', prep); else await store.add('prepGuides', { ...prep, applicationId: id }); setEditingPrep(false); loadData() }

  async function save(e) {
    e?.preventDefault()
    const record = { ...form, salaryMin: Number(form.salaryMin) || null, salaryMax: Number(form.salaryMax) || null }
    if (id === 'new') { if (!record.statusHistory.length) record.statusHistory = [{ fromStatus: null, toStatus: record.status, timestamp: new Date().toISOString(), note: 'Created' }]; await store.add('applications', record) }
    else await store.put('applications', record)
    onSaved()
  }
  async function remove() { if (id !== 'new' && confirm('Delete?')) { await store.delete('applications', id); onSaved() } }

  const linkedResumes = resumes.filter(r => (r.linkedApps || []).includes(id))
  const upcomingRounds = rounds.filter(r => r.date && new Date(r.date) >= new Date(new Date().toISOString().slice(0, 10)))

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-[540px] h-full bg-bg-card shadow-2xl flex flex-col animate-[slideIn_0.2s_ease]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <CompanyLogo company={form.company} size={36} />
              <div>
                <h2 className="text-sm font-bold leading-tight">{form.company || 'New'} <span className="text-muted font-normal">· {form.role || 'Role'}</span></h2>
                <div className="flex items-center gap-1.5 mt-0.5"><StatusPill status={form.status} />{form.source && <span className="text-[9px] text-muted bg-bg-secondary px-1.5 py-0.5 rounded-full">{form.source}</span>}</div>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full border-0 bg-bg-secondary hover:bg-border text-muted text-xs">✕</button>
          </div>

          {/* Workflow stepper */}
          {id !== 'new' && <div className="flex bg-bg-secondary rounded-lg p-0.5">
            {WORKFLOW_STEPS.map(s => (
              <button key={s.id} type="button" onClick={() => setStep(s.id)}
                className={`flex-1 text-[10px] py-1.5 rounded-md border-0 transition-all flex items-center justify-center gap-1 ${step === s.id ? 'bg-bg-card shadow-sm font-bold text-text-primary' : 'bg-transparent text-muted hover:text-text-primary'}`}>
                <span>{s.icon}</span>{s.label}
              </button>
            ))}
          </div>}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ═══ STEP: INFO ═══ */}
          {(step === 'info' || id === 'new') && <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label>Company *</label><input required value={form.company} onChange={set('company')} placeholder="Acme Inc." /></div>
              <div><label>Role *</label><input required value={form.role} onChange={set('role')} placeholder="Sr. Engineer" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label>Status</label>{id === 'new' ? <select value={form.status} onChange={set('status')}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select> : <StatusPill status={form.status} />}</div>
              <div><label>Source</label><select value={form.source} onChange={set('source')}><option value="">—</option>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label>Date</label><input type="date" value={form.dateApplied} onChange={set('dateApplied')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label>Salary Min</label><input type="number" placeholder="100k" value={form.salaryMin} onChange={set('salaryMin')} /></div>
              <div><label>Salary Max</label><input type="number" placeholder="150k" value={form.salaryMax} onChange={set('salaryMax')} /></div>
            </div>
            <div><label>JD Link</label><input value={form.jdLink} onChange={set('jdLink')} placeholder="https://..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label>Contact</label><input value={form.contactName} onChange={set('contactName')} placeholder="Name" /></div>
              <div><label>Email</label><input type="email" value={form.contactEmail} onChange={set('contactEmail')} /></div>
            </div>
            <div><label>Notes</label><textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Context..." /></div>
            <div>
              <label>Tags</label>
              <div className="flex gap-1.5">
                <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Type & Enter" className="flex-1" />
                <button type="button" onClick={addTag} className="px-3">+</button>
              </div>
              {form.tags.length > 0 && <div className="flex gap-1 flex-wrap mt-1.5">{form.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent cursor-pointer hover:bg-red-100 hover:text-red-600" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))}>{t} ✕</span>)}</div>}
            </div>

            {/* Resume */}
            <div>
              <label>Resume</label>
              {linkedResumes.map(r => (
                <div key={r.id} className="flex items-center gap-2 rounded-md p-2 bg-accent/5 mb-1">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${r.category === 'Tailored' ? 'bg-purple-50 text-purple-700' : 'bg-sky-50 text-sky-700'}`}>{r.category === 'Tailored' ? '🎯' : '📋'}</span>
                  <span className="text-xs flex-1 truncate">{r.name}</span>
                  {id !== 'new' && <button type="button" onClick={() => toggleResumeLink(r.id)} className="text-[9px] text-danger border-0 bg-transparent p-0">✕</button>}
                </div>
              ))}
              {id !== 'new' && resumes.filter(r => !(r.linkedApps || []).includes(id)).length > 0 && <div className="flex flex-wrap gap-1 mb-1.5">{resumes.filter(r => !(r.linkedApps || []).includes(id)).map(r => <button key={r.id} type="button" onClick={() => toggleResumeLink(r.id)} className="text-[9px] px-2 py-0.5 rounded bg-bg-secondary border-0 hover:bg-accent/10 hover:text-accent">+ {r.name}</button>)}</div>}
              <div className="flex gap-1.5 items-center">
                <input placeholder="Name" value={resumeName} onChange={e => setResumeName(e.target.value)} className="flex-1" />
                <select value={resumeCategory} onChange={e => setResumeCategory(e.target.value)} className="w-24"><option>General</option><option>Tailored</option></select>
                <button type="button" onClick={() => fileRef.current?.click()} className="text-[10px] shrink-0">{resumeFile ? '📎' : '📁'}</button>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={e => setResumeFile(e.target.files[0])} />
                {resumeFile && resumeName && <button type="button" className="primary text-[10px] px-2 shrink-0" onClick={uploadResume}>↑</button>}
              </div>
            </div>
          </div>}

          {/* ═══ STEP: PREP ═══ */}
          {step === 'prep' && id !== 'new' && <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">📚 Interview Prep</p>
              {!editingPrep && <button type="button" onClick={() => { if (!prep) setPrep({ companyResearch: '', talkingPoints: '', anticipatedQuestions: '', storyBankLinks: '' }); setEditingPrep(true) }} className="text-[10px] text-accent border-0 bg-transparent p-0 font-semibold">{prep ? '✏️ Edit' : '+ Start Prep'}</button>}
            </div>

            {editingPrep ? <div className="space-y-3">
              <div><label>Company Research</label><textarea rows={3} value={prep?.companyResearch || ''} onChange={e => setPrep(p => ({ ...p, companyResearch: e.target.value }))} placeholder="Mission, team size, funding, culture..." /></div>
              <div><label>Talking Points</label><textarea rows={3} value={prep?.talkingPoints || ''} onChange={e => setPrep(p => ({ ...p, talkingPoints: e.target.value }))} placeholder="Key experiences to highlight for this role..." /></div>
              <div><label>Anticipated Questions</label><textarea rows={3} value={prep?.anticipatedQuestions || ''} onChange={e => setPrep(p => ({ ...p, anticipatedQuestions: e.target.value }))} placeholder="Tell me about a time..., System design for..." /></div>
              <div><label>Story Bank / Links</label><textarea rows={2} value={prep?.storyBankLinks || ''} onChange={e => setPrep(p => ({ ...p, storyBankLinks: e.target.value }))} placeholder="Links to docs, STAR stories..." /></div>
              <div className="flex gap-2"><button type="button" className="primary flex-1" onClick={savePrep}>Save Prep</button><button type="button" onClick={() => setEditingPrep(false)}>Cancel</button></div>
            </div> : prep ? <div className="space-y-3">
              {prep.companyResearch && <div className="rounded-lg bg-bg-secondary p-3"><p className="text-[9px] font-bold uppercase text-muted mb-1">Research</p><p className="text-xs whitespace-pre-wrap">{prep.companyResearch}</p></div>}
              {prep.talkingPoints && <div className="rounded-lg bg-bg-secondary p-3"><p className="text-[9px] font-bold uppercase text-muted mb-1">Talking Points</p><p className="text-xs whitespace-pre-wrap">{prep.talkingPoints}</p></div>}
              {prep.anticipatedQuestions && <div className="rounded-lg bg-bg-secondary p-3"><p className="text-[9px] font-bold uppercase text-muted mb-1">Questions</p><p className="text-xs whitespace-pre-wrap">{prep.anticipatedQuestions}</p></div>}
              {prep.storyBankLinks && <div className="rounded-lg bg-bg-secondary p-3"><p className="text-[9px] font-bold uppercase text-muted mb-1">Stories & Links</p><p className="text-xs whitespace-pre-wrap">{prep.storyBankLinks}</p></div>}
            </div> : <div className="text-center py-8"><p className="text-2xl mb-2">📚</p><p className="text-xs text-muted">No prep yet. Click "Start Prep" to research this company.</p></div>}
          </div>}

          {/* ═══ STEP: INTERVIEWS ═══ */}
          {step === 'interviews' && id !== 'new' && <div className="space-y-3">
            {/* Upcoming banner */}
            {upcomingRounds.length > 0 && <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-2.5">
              <p className="text-[9px] font-bold uppercase text-indigo-600 mb-1">📅 Upcoming</p>
              {upcomingRounds.sort((a, b) => new Date(a.date) - new Date(b.date)).map(r => {
                const d = Math.ceil((new Date(r.date) - new Date(new Date().toISOString().slice(0, 10))) / 86400000)
                return <div key={r.id} className="flex items-center gap-2 py-0.5"><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${d === 0 ? 'bg-amber-400 text-white' : 'bg-indigo-200 text-indigo-800'}`}>{d === 0 ? 'TODAY' : `${d}d`}</span><span className="text-[11px]">{r.type}</span><span className="text-[10px] text-muted">{format(new Date(r.date), 'MMM d')}{r.interviewer ? ` · ${r.interviewer}` : ''}</span></div>
              })}
            </div>}

            {/* Rounds */}
            {rounds.map((r, i) => {
              const retro = retros.find(rt => rt.roundId === r.id)
              return (
                <div key={r.id} className="rounded-lg border border-border overflow-hidden">
                  <div className="flex items-center gap-2 p-2.5 bg-bg-secondary/50">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: '#7c3aed' }}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold">{r.type}</p>
                      <p className="text-[10px] text-muted">{r.date ? format(new Date(r.date), 'MMM d') : ''}{r.interviewer ? ` · ${r.interviewer}` : ''}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${RESULT_COLORS[r.result] || RESULT_COLORS.Pending}`}>{r.result || 'Pending'}</span>
                    <button type="button" onClick={() => startRetro(r)} className="text-[10px] border-0 bg-transparent text-accent p-0">{retro ? '📝' : '➕'}</button>
                    <button type="button" onClick={() => deleteRound(r.id)} className="text-[10px] border-0 bg-transparent text-danger p-0">✕</button>
                  </div>
                  {r.notes && <p className="px-2.5 py-1 text-[10px] text-muted border-t border-border">{r.notes}</p>}
                  {retro && editingRetro !== r.id && <div className="px-2.5 py-2 border-t border-border bg-green-50/30 space-y-0.5">
                    <p className="text-[10px]"><strong className="text-green-700">✓</strong> {retro.wentWell}</p>
                    <p className="text-[10px]"><strong className="text-red-600">✗</strong> {retro.wentPoorly}</p>
                    {retro.learned && <p className="text-[10px]"><strong className="text-blue-600">💡</strong> {retro.learned}</p>}
                    <p className="text-[10px] text-muted">{'★'.repeat(retro.confidence)}{'☆'.repeat(5 - retro.confidence)}</p>
                  </div>}
                  {editingRetro === r.id && <div className="px-2.5 py-2.5 border-t border-border space-y-2">
                    <div><label className="text-[9px]">Went well</label><textarea rows={1} value={retroForm?.wentWell || ''} onChange={e => setRetroForm(f => ({ ...f, wentWell: e.target.value }))} /></div>
                    <div><label className="text-[9px]">Went poorly</label><textarea rows={1} value={retroForm?.wentPoorly || ''} onChange={e => setRetroForm(f => ({ ...f, wentPoorly: e.target.value }))} /></div>
                    <div><label className="text-[9px]">Learned</label><input value={retroForm?.learned || ''} onChange={e => setRetroForm(f => ({ ...f, learned: e.target.value }))} /></div>
                    <div className="flex items-center gap-1"><span className="text-[9px] text-muted">Confidence:</span>{[1,2,3,4,5].map(n => <button key={n} type="button" onClick={() => setRetroForm(f => ({...f, confidence: n}))} className={`w-5 h-5 rounded border-0 text-[10px] ${n <= (retroForm?.confidence||3) ? 'bg-amber-400 text-white' : 'bg-bg-secondary text-muted'}`}>★</button>)}</div>
                    <div className="flex gap-1"><button type="button" className="primary text-[10px] flex-1" onClick={saveRetro}>Save</button><button type="button" className="text-[10px]" onClick={() => {setEditingRetro(null);setRetroForm(null)}}>✕</button></div>
                  </div>}
                </div>
              )
            })}

            {/* Add round */}
            {roundForm ? <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2">
              <p className="text-[10px] font-bold text-accent">Round #{rounds.length + 1}</p>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px]">Type</label><select value={roundForm.type} onChange={e => setRoundForm(f => ({...f, type: e.target.value}))}>{ROUND_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                <div><label className="text-[9px]">Date</label><input type="date" value={roundForm.date} onChange={e => setRoundForm(f => ({...f, date: e.target.value}))} /></div>
              </div>
              <div><label className="text-[9px]">Interviewer(s)</label><input value={roundForm.interviewer} onChange={e => setRoundForm(f => ({...f, interviewer: e.target.value}))} placeholder="Jane (Sr Eng)" /></div>
              <div><label className="text-[9px]">Result</label><div className="flex gap-1">{ROUND_RESULT.map(r => <button key={r} type="button" onClick={() => setRoundForm(f => ({...f, result: r}))} className={`flex-1 text-[9px] py-1 rounded border ${roundForm.result === r ? RESULT_COLORS[r]+' font-bold border-current' : 'bg-transparent text-muted border-border'}`}>{r}</button>)}</div></div>
              <div><label className="text-[9px]">Notes</label><input value={roundForm.notes || ''} onChange={e => setRoundForm(f => ({...f, notes: e.target.value}))} placeholder="Format, topics..." /></div>
              <div className="flex gap-1.5"><button type="button" className="primary text-[10px] flex-1" onClick={saveRound}>Add</button><button type="button" className="text-[10px]" onClick={() => setRoundForm(null)}>Cancel</button></div>
            </div> : <button type="button" onClick={() => setRoundForm({ type: 'Technical', date: new Date().toISOString().slice(0, 10), interviewer: '', result: 'Pending', notes: '' })} className="w-full border-dashed border-border text-muted text-[11px] py-3 hover:border-accent hover:text-accent">+ Add Interview Round</button>}

            {rounds.length === 0 && !roundForm && <div className="text-center py-6"><p className="text-2xl mb-1">🎯</p><p className="text-xs text-muted">No interviews yet. Add your first round when scheduled.</p></div>}
          </div>}

          {/* ═══ STEP: OUTCOME ═══ */}
          {step === 'outcome' && id !== 'new' && <div className="space-y-4">
            {/* Status change */}
            <div>
              <p className="text-xs font-semibold mb-2">Update Status</p>
              <div className="grid grid-cols-3 gap-1.5">
                {STATUSES.filter(s => s !== form.status).map(s => (
                  <button key={s} type="button" onClick={() => setNewStatus(s)} className={`border-0 bg-transparent p-0 ${newStatus === s ? 'ring-2 ring-accent rounded-full' : ''}`}><StatusPill status={s} /></button>
                ))}
              </div>
              {newStatus && <div className="mt-2 bg-bg-secondary rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2"><StatusPill status={form.status} /><span className="text-muted">→</span><StatusPill status={newStatus} /></div>
                <input placeholder="Note (optional)" value={statusNote} onChange={e => setStatusNote(e.target.value)} />
                <button type="button" className="primary w-full" onClick={() => changeStatus(newStatus)}>Confirm</button>
              </div>}
            </div>

            {/* Timeline */}
            {form.statusHistory.length > 0 && <div>
              <p className="text-xs font-semibold mb-2">Journey</p>
              <div className="relative pl-4 space-y-1.5">
                <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
                {[...form.statusHistory].reverse().map((h, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-4 top-1 w-2 h-2 rounded-full" style={{ backgroundColor: (STATUS_COLORS[h.toStatus] || ['#6b7280'])[0] }} />
                    <div className="pl-2 flex items-center gap-1.5 flex-wrap">
                      {h.fromStatus && <><StatusPill status={h.fromStatus} /><span className="text-[10px] text-muted">→</span></>}
                      <StatusPill status={h.toStatus} />
                      <span className="text-[9px] text-muted ml-auto">{format(new Date(h.timestamp), 'MMM d')}</span>
                    </div>
                    {h.note && <p className="pl-2 text-[10px] text-muted italic">"{h.note}"</p>}
                  </div>
                ))}
              </div>
            </div>}

            {/* Summary */}
            <div className="rounded-lg bg-bg-secondary p-3">
              <p className="text-[9px] font-bold uppercase text-muted mb-1">Summary</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-lg font-bold text-accent">{rounds.length}</p><p className="text-[9px] text-muted">Rounds</p></div>
                <div><p className="text-lg font-bold text-green-600">{rounds.filter(r => r.result === 'Passed').length}</p><p className="text-[9px] text-muted">Passed</p></div>
                <div><p className="text-lg font-bold text-amber-600">{Math.round((form.statusHistory?.length || 0) > 1 ? (new Date() - new Date(form.statusHistory[0]?.timestamp)) / 86400000 : 0)}d</p><p className="text-[9px] text-muted">In Pipeline</p></div>
              </div>
            </div>
          </div>}

        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-border bg-bg-card flex items-center gap-2">
          <button type="button" className="primary flex-1 py-2" onClick={save}>{id === 'new' ? '🚀 Create' : '💾 Save'}</button>
          {id !== 'new' && <button type="button" onClick={() => exportApplicationPDF(id)} className="px-2.5">📄</button>}
          {id !== 'new' && <button type="button" className="danger px-2.5" onClick={remove}>🗑</button>}
        </div>
      </div>
      <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
    </div>
  )
}
