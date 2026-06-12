import { useState, useEffect, useRef } from 'react'
import { store } from '../../lib/store'
import { exportApplicationPDF } from '../../lib/pdf'
import { STATUSES, SOURCES } from '../../lib/constants'
import { format, differenceInDays } from 'date-fns'
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

function Pill({ status }) {
  const [c, bg] = STATUS_COLORS[status] || ['#6b7280', '#f3f4f6']
  return <span className="inline-flex items-center rounded-full font-semibold text-[10px] px-2 py-0.5" style={{ color: c, backgroundColor: bg }}>{status}</span>
}

// Determine which stage this status belongs to
function getStage(status) {
  if (['Wishlist', 'Applied', 'Referred'].includes(status)) return 'pipeline'
  if (['Recruiter Screen Scheduled', 'Recruiter Screen Done'].includes(status)) return 'screening'
  if (['Interview Scheduled', 'Interview In Progress'].includes(status)) return 'interviewing'
  if (['Offer', 'Offer Negotiation', 'Accepted'].includes(status)) return 'decision'
  return 'closed'
}

const emptyApp = { company: '', role: '', jdLink: '', jdText: '', dateApplied: new Date().toISOString().slice(0, 10), status: 'Wishlist', source: '', contactName: '', contactEmail: '', salaryMin: '', salaryMax: '', notes: '', tags: [], statusHistory: [] }

export default function ApplicationDrawer({ id, onClose, onSaved }) {
  const [form, setForm] = useState(emptyApp)
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
    const [allR, allRt, allP] = await Promise.all([store.getAll('interviewRounds'), store.getAll('retrospectives'), store.getAll('prepGuides')])
    setRounds(allR.filter(r => r.applicationId === id).sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0)))
    setRetros(allRt.filter(r => r.applicationId === id))
    setPrep(allP.find(p => p.applicationId === id) || null)
  }

  function set(f) { return e => setForm(x => ({ ...x, [f]: e.target.value })) }
  function addTag() { const t = tagInput.trim(); if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t] })); setTagInput('') }
  function changeStatus(to) { if (!to || to === form.status) return; setForm(f => ({ ...f, status: to, statusHistory: [...f.statusHistory, { fromStatus: f.status, toStatus: to, timestamp: new Date().toISOString(), note: statusNote || undefined }] })); setNewStatus(''); setStatusNote('') }
  async function toggleResume(rid) { if (id === 'new') return; const r = resumes.find(x => x.id === rid); const l = r.linkedApps || []; await store.put('resumes', { ...r, linkedApps: l.includes(id) ? l.filter(x => x !== id) : [...l, id] }); setResumes(await store.getAll('resumes')) }
  async function uploadResume() { if (!resumeFile || !resumeName.trim()) return; const reader = new FileReader(); reader.onload = async () => { await store.add('resumes', { name: resumeName.trim(), category: resumeCategory, fileName: resumeFile.name, type: resumeFile.type, data: reader.result, linkedApps: id !== 'new' ? [id] : [], createdAt: new Date().toISOString() }); setResumes(await store.getAll('resumes')); setResumeFile(null); setResumeName(''); setResumeCategory('General') }; reader.readAsDataURL(resumeFile) }
  async function saveRound() { if (!roundForm) return; const rec = { ...roundForm, applicationId: id, roundNumber: rounds.length + 1 }; if (roundForm.id) await store.put('interviewRounds', rec); else await store.add('interviewRounds', rec); setRoundForm(null); loadData() }
  async function deleteRound(rid) { if (!confirm('Delete?')) return; await store.delete('interviewRounds', rid); loadData() }
  async function saveRetro() { if (!retroForm) return; if (retroForm.id) await store.put('retrospectives', retroForm); else await store.add('retrospectives', retroForm); setEditingRetro(null); setRetroForm(null); loadData() }
  function startRetro(round) { const ex = retros.find(r => r.roundId === round.id); setRetroForm(ex || { roundId: round.id, applicationId: id, wentWell: '', wentPoorly: '', learned: '', confidence: 3 }); setEditingRetro(round.id) }
  async function savePrep() { if (!prep) return; if (prep.id) await store.put('prepGuides', prep); else await store.add('prepGuides', { ...prep, applicationId: id }); setEditingPrep(false); loadData() }
  async function save(e) { e?.preventDefault(); const rec = { ...form, salaryMin: Number(form.salaryMin) || null, salaryMax: Number(form.salaryMax) || null }; if (id === 'new') { if (!rec.statusHistory.length) rec.statusHistory = [{ fromStatus: null, toStatus: rec.status, timestamp: new Date().toISOString(), note: 'Created' }]; await store.add('applications', rec) } else await store.put('applications', rec); onSaved() }
  async function remove() { if (id !== 'new' && confirm('Delete?')) { await store.delete('applications', id); onSaved() } }

  const linkedResumes = resumes.filter(r => (r.linkedApps || []).includes(id))
  const stage = getStage(form.status)
  const daysSince = form.dateApplied ? differenceInDays(new Date(), new Date(form.dateApplied)) : 0

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-[540px] h-full bg-bg-card shadow-2xl flex flex-col animate-[slideIn_0.2s_ease]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CompanyLogo company={form.company} size={36} />
              <div>
                <h2 className="text-sm font-bold">{form.company || 'New'} <span className="text-muted font-normal">· {form.role || 'Role'}</span></h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Pill status={form.status} />
                  {daysSince > 0 && <span className="text-[9px] text-muted">{daysSince}d in pipeline</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full border-0 bg-bg-secondary text-muted text-xs">✕</button>
          </div>
        </div>

        {/* Stage-aware content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ─── Always: quick status advance ─── */}
          {id !== 'new' && <QuickAdvance status={form.status} newStatus={newStatus} setNewStatus={setNewStatus} statusNote={statusNote} setStatusNote={setStatusNote} changeStatus={changeStatus} />}

          {/* ─── STAGE: Pipeline (Wishlist/Applied/Referred) ─── */}
          {/* Focus: application details, resume, source */}
          {(id === 'new' || stage === 'pipeline') && <>
            <Section title="Application Details">
              <div className="grid grid-cols-2 gap-2">
                <div><label>Company *</label><input required value={form.company} onChange={set('company')} placeholder="Acme" /></div>
                <div><label>Role *</label><input required value={form.role} onChange={set('role')} placeholder="SDE II" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label>Status</label>{id === 'new' ? <select value={form.status} onChange={set('status')}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select> : <Pill status={form.status} />}</div>
                <div><label>Source</label><select value={form.source} onChange={set('source')}><option value="">—</option>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label>Date</label><input type="date" value={form.dateApplied} onChange={set('dateApplied')} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label>Salary Min</label><input type="number" value={form.salaryMin} onChange={set('salaryMin')} /></div>
                <div><label>Salary Max</label><input type="number" value={form.salaryMax} onChange={set('salaryMax')} /></div>
              </div>
              <div><label>JD Link</label><input value={form.jdLink} onChange={set('jdLink')} placeholder="https://..." /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label>Contact</label><input value={form.contactName} onChange={set('contactName')} /></div>
                <div><label>Email</label><input value={form.contactEmail} onChange={set('contactEmail')} /></div>
              </div>
              <div><label>Notes</label><textarea rows={2} value={form.notes} onChange={set('notes')} /></div>
              <TagsInput tags={form.tags} tagInput={tagInput} setTagInput={setTagInput} addTag={addTag} setForm={setForm} />
            </Section>
            <ResumeSection linked={linkedResumes} available={resumes.filter(r => !(r.linkedApps||[]).includes(id))} toggle={toggleResume} upload={uploadResume} resumeName={resumeName} setResumeName={setResumeName} resumeCategory={resumeCategory} setResumeCategory={setResumeCategory} resumeFile={resumeFile} setResumeFile={setResumeFile} fileRef={fileRef} isNew={id === 'new'} />
          </>}

          {/* ─── STAGE: Screening ─── */}
          {/* Focus: prep, contacts */}
          {stage === 'screening' && <>
            <PrepSection prep={prep} editingPrep={editingPrep} setEditingPrep={setEditingPrep} setPrep={setPrep} savePrep={savePrep} />
            <Section title="Contacts & Notes">
              <div className="grid grid-cols-2 gap-2">
                <div><label>Contact</label><input value={form.contactName} onChange={set('contactName')} /></div>
                <div><label>Email</label><input value={form.contactEmail} onChange={set('contactEmail')} /></div>
              </div>
              <div><label>Notes</label><textarea rows={2} value={form.notes} onChange={set('notes')} /></div>
            </Section>
          </>}

          {/* ─── STAGE: Interviewing ─── */}
          {/* Focus: rounds, retros, prep */}
          {stage === 'interviewing' && <>
            <InterviewSection rounds={rounds} retros={retros} roundForm={roundForm} setRoundForm={setRoundForm} saveRound={saveRound} deleteRound={deleteRound} editingRetro={editingRetro} retroForm={retroForm} setRetroForm={setRetroForm} startRetro={startRetro} saveRetro={saveRetro} setEditingRetro={setEditingRetro} />
            <PrepSection prep={prep} editingPrep={editingPrep} setEditingPrep={setEditingPrep} setPrep={setPrep} savePrep={savePrep} />
          </>}

          {/* ─── STAGE: Decision (Offer/Negotiation/Accepted) ─── */}
          {/* Focus: offer details, negotiation notes, summary */}
          {stage === 'decision' && <>
            <Section title="Offer Details">
              <div className="grid grid-cols-2 gap-2">
                <div><label>Salary Min</label><input type="number" value={form.salaryMin} onChange={set('salaryMin')} /></div>
                <div><label>Salary Max</label><input type="number" value={form.salaryMax} onChange={set('salaryMax')} /></div>
              </div>
              <div><label>Negotiation Notes</label><textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Counter offer, benefits, equity..." /></div>
            </Section>
            <SummarySection rounds={rounds} statusHistory={form.statusHistory} daysSince={daysSince} />
          </>}

          {/* ─── STAGE: Closed ─── */}
          {/* Focus: retrospective summary, what to learn */}
          {stage === 'closed' && <>
            <SummarySection rounds={rounds} statusHistory={form.statusHistory} daysSince={daysSince} />
            {rounds.length > 0 && <InterviewSection rounds={rounds} retros={retros} roundForm={roundForm} setRoundForm={setRoundForm} saveRound={saveRound} deleteRound={deleteRound} editingRetro={editingRetro} retroForm={retroForm} setRetroForm={setRetroForm} startRetro={startRetro} saveRetro={saveRetro} setEditingRetro={setEditingRetro} />}
          </>}

          {/* ─── Always: history ─── */}
          {id !== 'new' && form.statusHistory.length > 0 && <Section title="Journey">
            <div className="relative pl-3 space-y-1">
              <div className="absolute left-[4px] top-1 bottom-1 w-px bg-border" />
              {[...form.statusHistory].reverse().slice(0, 5).map((h, i) => (
                <div key={i} className="relative flex items-center gap-1.5 pl-2">
                  <div className="absolute -left-3 w-2 h-2 rounded-full" style={{ backgroundColor: (STATUS_COLORS[h.toStatus] || ['#6b7280'])[0] }} />
                  {h.fromStatus && <><Pill status={h.fromStatus} /><span className="text-[9px] text-muted">→</span></>}
                  <Pill status={h.toStatus} />
                  <span className="text-[9px] text-muted ml-auto">{format(new Date(h.timestamp), 'MMM d')}</span>
                </div>
              ))}
            </div>
          </Section>}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-border flex gap-2">
          <button type="button" className="primary flex-1 py-2" onClick={save}>{id === 'new' ? '🚀 Create' : '💾 Save'}</button>
          {id !== 'new' && <button type="button" onClick={() => exportApplicationPDF(id)} className="px-2.5">📄</button>}
          {id !== 'new' && <button type="button" className="danger px-2.5" onClick={remove}>🗑</button>}
        </div>
      </div>
      <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
    </div>
  )
}

/* ─── Sub-components ─── */

function Section({ title, children }) {
  return <div className="space-y-2"><p className="text-xs font-bold">{title}</p>{children}</div>
}

function QuickAdvance({ status, newStatus, setNewStatus, statusNote, setStatusNote, changeStatus }) {
  // Show the likely next steps for current stage
  const stage = getStage(status)
  const nextStatuses = stage === 'pipeline' ? ['Recruiter Screen Scheduled', 'Interview Scheduled', 'Rejected', 'Ghosted']
    : stage === 'screening' ? ['Interview Scheduled', 'Rejected', 'Ghosted']
    : stage === 'interviewing' ? ['Offer', 'Rejected', 'Withdrawn']
    : stage === 'decision' ? ['Accepted', 'Rejected', 'Withdrawn']
    : ['Applied'] // closed -> reopen
  return (
    <div className="bg-bg-secondary rounded-lg p-3">
      <p className="text-[9px] font-bold uppercase text-muted mb-1.5">Next Step</p>
      <div className="flex flex-wrap gap-1">
        {nextStatuses.filter(s => s !== status).map(s => (
          <button key={s} type="button" onClick={() => setNewStatus(s)} className={`border-0 bg-transparent p-0 ${newStatus === s ? 'ring-2 ring-accent ring-offset-1 rounded-full' : ''}`}><Pill status={s} /></button>
        ))}
        {!nextStatuses.includes('') && <button type="button" onClick={() => setNewStatus(newStatus ? '' : '__more')} className="text-[9px] text-accent border-0 bg-transparent">{newStatus === '__more' ? 'Less' : '···'}</button>}
      </div>
      {newStatus === '__more' && <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-border">{STATUSES.filter(s => s !== status && !nextStatuses.includes(s)).map(s => <button key={s} type="button" onClick={() => setNewStatus(s)} className="border-0 bg-transparent p-0"><Pill status={s} /></button>)}</div>}
      {newStatus && newStatus !== '__more' && <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-1.5"><Pill status={status} /><span className="text-[9px] text-muted">→</span><Pill status={newStatus} /></div>
        <input placeholder="Note (optional)" value={statusNote} onChange={e => setStatusNote(e.target.value)} />
        <button type="button" className="primary w-full text-[11px]" onClick={() => changeStatus(newStatus)}>Confirm Move</button>
      </div>}
    </div>
  )
}

function TagsInput({ tags, tagInput, setTagInput, addTag, setForm }) {
  return <div>
    <label>Tags</label>
    <div className="flex gap-1.5"><input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Type & Enter" className="flex-1" /><button type="button" onClick={addTag} className="px-2">+</button></div>
    {tags.length > 0 && <div className="flex gap-1 flex-wrap mt-1">{tags.map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent cursor-pointer hover:bg-red-100 hover:text-red-600" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))}>{t} ✕</span>)}</div>}
  </div>
}

function ResumeSection({ linked, available, toggle, upload, resumeName, setResumeName, resumeCategory, setResumeCategory, resumeFile, setResumeFile, fileRef, isNew }) {
  return <Section title="Resume">
    {linked.map(r => <div key={r.id} className="flex items-center gap-2 bg-accent/5 rounded-md p-2 mb-1"><span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${r.category === 'Tailored' ? 'bg-purple-50 text-purple-700' : 'bg-sky-50 text-sky-700'}`}>{r.category === 'Tailored' ? '🎯' : '📋'}</span><span className="text-xs flex-1 truncate">{r.name}</span>{!isNew && <button type="button" onClick={() => toggle(r.id)} className="text-[9px] text-danger border-0 bg-transparent p-0">✕</button>}</div>)}
    {!isNew && available.length > 0 && <div className="flex flex-wrap gap-1 mb-1">{available.map(r => <button key={r.id} type="button" onClick={() => toggle(r.id)} className="text-[9px] px-2 py-0.5 rounded bg-bg-secondary border-0 hover:bg-accent/10 hover:text-accent">+ {r.name}</button>)}</div>}
    <div className="flex gap-1.5 items-center"><input placeholder="New resume name" value={resumeName} onChange={e => setResumeName(e.target.value)} className="flex-1" /><select value={resumeCategory} onChange={e => setResumeCategory(e.target.value)} className="w-20 text-[10px]"><option>General</option><option>Tailored</option></select><button type="button" onClick={() => fileRef.current?.click()} className="text-[10px] shrink-0 px-2">{resumeFile ? '📎' : '📁'}</button><input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" onChange={e => setResumeFile(e.target.files[0])} />{resumeFile && resumeName && <button type="button" className="primary text-[10px] px-2" onClick={upload}>↑</button>}</div>
  </Section>
}

function PrepSection({ prep, editingPrep, setEditingPrep, setPrep, savePrep }) {
  return <Section title="📚 Prep">
    {!editingPrep && <button type="button" onClick={() => { if (!prep) setPrep({ companyResearch: '', talkingPoints: '', anticipatedQuestions: '', storyBankLinks: '' }); setEditingPrep(true) }} className="text-[10px] text-accent border-0 bg-transparent p-0 font-semibold mb-1">{prep ? '✏️ Edit' : '+ Start Prep'}</button>}
    {editingPrep ? <div className="space-y-2">
      <div><label className="text-[9px]">Research</label><textarea rows={2} value={prep?.companyResearch || ''} onChange={e => setPrep(p => ({ ...p, companyResearch: e.target.value }))} placeholder="Company, culture, news..." /></div>
      <div><label className="text-[9px]">Talking Points</label><textarea rows={2} value={prep?.talkingPoints || ''} onChange={e => setPrep(p => ({ ...p, talkingPoints: e.target.value }))} /></div>
      <div><label className="text-[9px]">Anticipated Questions</label><textarea rows={2} value={prep?.anticipatedQuestions || ''} onChange={e => setPrep(p => ({ ...p, anticipatedQuestions: e.target.value }))} /></div>
      <div><label className="text-[9px]">Stories/Links</label><input value={prep?.storyBankLinks || ''} onChange={e => setPrep(p => ({ ...p, storyBankLinks: e.target.value }))} /></div>
      <div className="flex gap-1.5"><button type="button" className="primary flex-1 text-[10px]" onClick={savePrep}>Save</button><button type="button" className="text-[10px]" onClick={() => setEditingPrep(false)}>Cancel</button></div>
    </div> : prep ? <div className="space-y-1.5">
      {prep.companyResearch && <div className="bg-bg-secondary rounded-md p-2"><p className="text-[8px] font-bold text-muted uppercase">Research</p><p className="text-[11px] mt-0.5 whitespace-pre-wrap">{prep.companyResearch}</p></div>}
      {prep.talkingPoints && <div className="bg-bg-secondary rounded-md p-2"><p className="text-[8px] font-bold text-muted uppercase">Talking Points</p><p className="text-[11px] mt-0.5 whitespace-pre-wrap">{prep.talkingPoints}</p></div>}
      {prep.anticipatedQuestions && <div className="bg-bg-secondary rounded-md p-2"><p className="text-[8px] font-bold text-muted uppercase">Questions</p><p className="text-[11px] mt-0.5 whitespace-pre-wrap">{prep.anticipatedQuestions}</p></div>}
    </div> : <p className="text-[10px] text-muted">No prep yet.</p>}
  </Section>
}

function InterviewSection({ rounds, retros, roundForm, setRoundForm, saveRound, deleteRound, editingRetro, retroForm, setRetroForm, startRetro, saveRetro, setEditingRetro }) {
  return <Section title="🎯 Interviews">
    {rounds.map((r, i) => {
      const retro = retros.find(rt => rt.roundId === r.id)
      return <div key={r.id} className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center gap-2 p-2 bg-bg-secondary/50">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: '#7c3aed' }}>{i+1}</div>
          <div className="flex-1 min-w-0"><p className="text-[11px] font-semibold">{r.type}</p><p className="text-[9px] text-muted">{r.date ? format(new Date(r.date), 'MMM d') : ''}{r.interviewer ? ` · ${r.interviewer}` : ''}</p></div>
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${RESULT_COLORS[r.result] || RESULT_COLORS.Pending}`}>{r.result}</span>
          <button type="button" onClick={() => startRetro(r)} className="text-[9px] border-0 bg-transparent text-accent p-0">{retro ? '📝' : '➕'}</button>
          <button type="button" onClick={() => deleteRound(r.id)} className="text-[9px] border-0 bg-transparent text-danger p-0">✕</button>
        </div>
        {retro && editingRetro !== r.id && <div className="px-2 py-1.5 border-t border-border text-[10px] bg-green-50/30"><strong className="text-green-700">✓</strong> {retro.wentWell} · <strong className="text-red-600">✗</strong> {retro.wentPoorly} · {'★'.repeat(retro.confidence)}</div>}
        {editingRetro === r.id && <div className="p-2 border-t border-border space-y-1.5">
          <input placeholder="Went well" value={retroForm?.wentWell||''} onChange={e => setRetroForm(f=>({...f,wentWell:e.target.value}))} />
          <input placeholder="Went poorly" value={retroForm?.wentPoorly||''} onChange={e => setRetroForm(f=>({...f,wentPoorly:e.target.value}))} />
          <input placeholder="Learned" value={retroForm?.learned||''} onChange={e => setRetroForm(f=>({...f,learned:e.target.value}))} />
          <div className="flex gap-0.5">{[1,2,3,4,5].map(n=><button key={n} type="button" onClick={()=>setRetroForm(f=>({...f,confidence:n}))} className={`w-5 h-5 rounded border-0 text-[9px] ${n<=(retroForm?.confidence||3)?'bg-amber-400 text-white':'bg-bg-secondary text-muted'}`}>★</button>)}</div>
          <div className="flex gap-1"><button type="button" className="primary text-[10px] flex-1" onClick={saveRetro}>Save</button><button type="button" className="text-[10px]" onClick={()=>{setEditingRetro(null);setRetroForm(null)}}>✕</button></div>
        </div>}
      </div>
    })}
    {roundForm ? <div className="border border-accent/30 bg-accent/5 rounded-lg p-2.5 space-y-1.5">
      <div className="grid grid-cols-2 gap-1.5"><div><label className="text-[9px]">Type</label><select value={roundForm.type} onChange={e=>setRoundForm(f=>({...f,type:e.target.value}))}>{ROUND_TYPES.map(t=><option key={t}>{t}</option>)}</select></div><div><label className="text-[9px]">Date</label><input type="date" value={roundForm.date} onChange={e=>setRoundForm(f=>({...f,date:e.target.value}))} /></div></div>
      <div><label className="text-[9px]">Interviewer</label><input value={roundForm.interviewer} onChange={e=>setRoundForm(f=>({...f,interviewer:e.target.value}))} /></div>
      <div><label className="text-[9px]">Result</label><div className="flex gap-1">{ROUND_RESULT.map(r=><button key={r} type="button" onClick={()=>setRoundForm(f=>({...f,result:r}))} className={`flex-1 text-[8px] py-1 rounded border ${roundForm.result===r?RESULT_COLORS[r]+' font-bold border-current':'bg-transparent text-muted border-border'}`}>{r}</button>)}</div></div>
      <div className="flex gap-1"><button type="button" className="primary text-[10px] flex-1" onClick={saveRound}>Add</button><button type="button" className="text-[10px]" onClick={()=>setRoundForm(null)}>✕</button></div>
    </div> : <button type="button" onClick={()=>setRoundForm({type:'Technical',date:new Date().toISOString().slice(0,10),interviewer:'',result:'Pending',notes:''})} className="w-full border-dashed border-border text-muted text-[10px] py-2 hover:border-accent hover:text-accent">+ Add Round</button>}
  </Section>
}

function SummarySection({ rounds, statusHistory, daysSince }) {
  return <Section title="Summary">
    <div className="grid grid-cols-3 gap-2 text-center bg-bg-secondary rounded-lg p-3">
      <div><p className="text-lg font-bold text-accent">{rounds.length}</p><p className="text-[9px] text-muted">Rounds</p></div>
      <div><p className="text-lg font-bold text-green-600">{rounds.filter(r=>r.result==='Passed').length}</p><p className="text-[9px] text-muted">Passed</p></div>
      <div><p className="text-lg font-bold text-amber-600">{daysSince}d</p><p className="text-[9px] text-muted">Total</p></div>
    </div>
  </Section>
}
