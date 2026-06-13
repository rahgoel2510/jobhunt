import { useState, useEffect, useRef } from 'react'
import { store } from '../../lib/store'
import { exportApplicationPDF } from '../../lib/pdf'
import { STATUSES, SOURCES, PROCESS_STAGES, INTERVIEW_MEDIUMS, ROUND_TYPES, getGlassdoorUrl, getLevelsFyiUrl } from '../../lib/constants'
import { format } from 'date-fns'
import CompanyLogo from '../shared/CompanyLogo'
import { HelpDot } from '../shared/Tooltip'

const emptyApp = { company: '', role: '', jdLink: '', jdText: '', dateApplied: new Date().toISOString().slice(0, 10), status: 'Wishlist', source: '', contactName: '', contactEmail: '', salaryMin: '', salaryMax: '', salaryResearch: '', generalPrep: '', notes: '', tags: [], statusHistory: [] }

export default function ApplicationDrawer({ id, onClose, onSaved }) {
  const [form, setForm] = useState(emptyApp)
  const [rounds, setRounds] = useState([])
  const [roundForm, setRoundForm] = useState(null)
  const [expandedRound, setExpandedRound] = useState(null)
  const [resumes, setResumes] = useState([])
  const [resumeFile, setResumeFile] = useState(null)
  const [resumeName, setResumeName] = useState('')
  const [resumeCategory, setResumeCategory] = useState('General')
  const [showMore, setShowMore] = useState(null) // collapsed section key
  const fileRef = useRef()

  useEffect(() => {
    if (id !== 'new') { store.get('applications', id).then(a => a && setForm({ ...emptyApp, ...a, statusHistory: a.statusHistory || [] })); loadRounds() }
    store.getAll('resumes').then(setResumes)
  }, [id])

  async function loadRounds() {
    const all = await store.getAll('interviewRounds')
    setRounds(all.filter(r => r.applicationId === id).sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0)))
  }

  function set(f) { return e => setForm(x => ({ ...x, [f]: e.target.value })) }
  function advanceTo(toStatus) { setForm(f => ({ ...f, status: toStatus, statusHistory: [...f.statusHistory, { fromStatus: f.status, toStatus, timestamp: new Date().toISOString() }] })) }
  async function saveRound() { if (!roundForm) return; await store.add('interviewRounds', { ...roundForm, applicationId: id, roundNumber: rounds.length + 1 }); setRoundForm(null); loadRounds() }
  async function updateRound(round, updates) { await store.put('interviewRounds', { ...round, ...updates }); loadRounds() }
  async function deleteRound(rid) { if (confirm('Delete?')) { await store.delete('interviewRounds', rid); loadRounds() } }
  async function uploadResume() { if (!resumeFile || !resumeName.trim()) return; const reader = new FileReader(); reader.onload = async () => { await store.add('resumes', { name: resumeName.trim(), category: resumeCategory, fileName: resumeFile.name, type: resumeFile.type, data: reader.result, linkedApps: id !== 'new' ? [id] : [], createdAt: new Date().toISOString() }); setResumes(await store.getAll('resumes')); setResumeFile(null); setResumeName('') }; reader.readAsDataURL(resumeFile) }
  async function toggleResume(rid) { const r = resumes.find(x => x.id === rid); const l = r.linkedApps || []; await store.put('resumes', { ...r, linkedApps: l.includes(id) ? l.filter(x => x !== id) : [...l, id] }); setResumes(await store.getAll('resumes')) }
  async function save() { const rec = { ...form, salaryMin: Number(form.salaryMin) || null, salaryMax: Number(form.salaryMax) || null }; if (id === 'new') { if (!rec.statusHistory.length) rec.statusHistory = [{ fromStatus: null, toStatus: rec.status, timestamp: new Date().toISOString() }]; await store.add('applications', rec) } else await store.put('applications', rec); onSaved() }
  async function remove() { if (confirm('Delete this application?')) { await store.delete('applications', id); onSaved() } }

  const stageOrder = ['Wishlist', 'Applied', 'Recruiter Screen Scheduled', 'Recruiter Screen Done', 'Interview Scheduled', 'Interview In Progress', 'Offer', 'Accepted']
  const currentIdx = stageOrder.indexOf(form.status)
  const isTerminal = ['Rejected', 'Withdrawn', 'Ghosted'].includes(form.status)
  const linkedResumes = resumes.filter(r => (r.linkedApps || []).includes(id))
  const availableResumes = resumes.filter(r => !(r.linkedApps || []).includes(id))

  // What to show based on current stage
  const stage = currentIdx <= 1 ? 'apply' : currentIdx <= 3 ? 'screen' : currentIdx <= 5 ? 'interview' : 'offer'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-bg-card shadow-2xl rounded-xl flex flex-col animate-[fadeIn_0.15s_ease]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <CompanyLogo company={form.company} size={44} />
              <div>
                <h2 className="text-lg font-bold">{form.company || 'New Application'}</h2>
                <p className="text-sm text-muted">{form.role || 'Role'}{form.source ? ` · ${form.source}` : ''}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full border-0 bg-bg-secondary text-muted hover:bg-border">✕</button>
          </div>
          {/* Stepper */}
          {id !== 'new' && <div className="flex items-center">
            {PROCESS_STAGES.map((s, i) => {
              const reached = currentIdx >= i
              const isCurrent = stageOrder[currentIdx] === s.status || (s.status === 'Interview Scheduled' && form.status === 'Interview In Progress')
              return <div key={s.status} className="flex-1 flex flex-col items-center relative">
                {i > 0 && <div className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${reached ? 'bg-accent' : 'bg-border'}`} />}
                <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-base transition-all ${isCurrent ? 'bg-accent text-white shadow-md shadow-accent/30 ring-4 ring-accent/20 scale-110' : reached ? 'bg-accent text-white' : 'bg-bg-secondary text-muted border-2 border-border'}`}>{s.icon}</div>
                <span className={`text-[11px] mt-1.5 font-medium ${isCurrent ? 'text-accent font-bold' : reached ? 'text-text-primary' : 'text-muted'}`}>{s.label}</span>
              </div>
            })}
          </div>}
          {isTerminal && <div className="mt-2 text-center"><span className="font-bold px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">{form.status}</span></div>}
        </div>

        {/* Body — only show current stage content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Advance */}
          {id !== 'new' && !isTerminal && currentIdx < stageOrder.length - 1 && <div className="flex gap-2 items-center">
            <button type="button" className="primary flex-1 py-2" onClick={() => advanceTo(stageOrder[currentIdx + 1])}>→ {stageOrder[currentIdx + 1]}</button>
            <button type="button" className="text-xs border-red-200 text-red-600 hover:bg-red-50 px-3 py-2" onClick={() => advanceTo('Rejected')}>Reject</button>
            {currentIdx < 3 ? <button type="button" className="text-xs border-orange-200 text-orange-600 hover:bg-orange-50 px-3 py-2" onClick={() => advanceTo('Ghosted')}>Ghost</button>
              : <button type="button" className="text-xs border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2" onClick={() => advanceTo('Withdrawn')}>Withdraw</button>}
          </div>}

          {/* ═══ STAGE: Apply ═══ */}
          {(id === 'new' || stage === 'apply') && <div className="space-y-3">
            <SectionHead title="📋 Application Details" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company" required><input required value={form.company} onChange={set('company')} placeholder="e.g. Google" /></Field>
              <Field label="Role" required><input required value={form.role} onChange={set('role')} placeholder="e.g. Senior SDE" /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Status"><select value={form.status} onChange={set('status')}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Source"><select value={form.source} onChange={set('source')}><option value="">—</option>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Date"><input type="date" value={form.dateApplied} onChange={set('dateApplied')} /></Field>
            </div>
            <Field label="JD Link"><input value={form.jdLink} onChange={set('jdLink')} placeholder="https://..." /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact"><input value={form.contactName} onChange={set('contactName')} placeholder="Recruiter name" /></Field>
              <Field label="Email"><input value={form.contactEmail} onChange={set('contactEmail')} /></Field>
            </div>
            <Field label="Notes"><textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Why this role? Red flags?" /></Field>
            {/* Resume */}
            <div className="bg-bg-secondary rounded-lg p-3 space-y-2">
              <span className="text-sm font-semibold">📄 Resume used</span>
              {linkedResumes.map(r => <div key={r.id} className="flex items-center gap-2 bg-bg-card rounded-md p-2"><span className={`text-xs px-1.5 py-0.5 rounded font-bold ${r.category==='Tailored'?'bg-purple-50 text-purple-700':'bg-sky-50 text-sky-700'}`}>{r.category==='Tailored'?'🎯':'📋'}</span><span className="flex-1 truncate">{r.name}</span>{id!=='new'&&<button type="button" onClick={()=>toggleResume(r.id)} className="text-xs text-danger border-0 bg-transparent">✕</button>}</div>)}
              {id!=='new'&&availableResumes.length>0&&<div className="flex flex-wrap gap-1.5">{availableResumes.map(r=><button key={r.id} type="button" onClick={()=>toggleResume(r.id)} className="text-xs px-2 py-1 rounded-md bg-bg-card border border-border hover:border-accent hover:text-accent">+ {r.name}</button>)}</div>}
              <div className="flex gap-2 items-center"><input placeholder="New resume name" value={resumeName} onChange={e=>setResumeName(e.target.value)} className="flex-1" /><select value={resumeCategory} onChange={e=>setResumeCategory(e.target.value)} className="w-24"><option>General</option><option>Tailored</option></select><button type="button" onClick={()=>fileRef.current?.click()} className="px-2">{resumeFile?'📎':'📁'}</button><input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" onChange={e=>setResumeFile(e.target.files[0])} />{resumeFile&&resumeName&&<button type="button" className="primary px-3" onClick={uploadResume}>Upload</button>}</div>
            </div>
          </div>}

          {/* ═══ STAGE: Screening ═══ */}
          {stage === 'screen' && <div className="space-y-4">
            <SectionHead title="💰 Salary Research" subtitle="Research now — the recruiter WILL ask your expectations." />
            <div className="flex gap-2">
              {form.company&&form.role&&<><a href={getGlassdoorUrl(form.company,form.role)} target="_blank" rel="noopener" className="flex-1 text-center py-2 rounded-md bg-green-50 text-green-700 border border-green-200 font-semibold no-underline hover:bg-green-100">🔍 Glassdoor</a><a href={getLevelsFyiUrl(form.company,form.role)} target="_blank" rel="noopener" className="flex-1 text-center py-2 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-semibold no-underline hover:bg-blue-100">📊 Levels.fyi</a><a href={`https://www.ambitionbox.com/salaries/${encodeURIComponent(form.company.toLowerCase().replace(/\s+/g,'-'))}-salaries`} target="_blank" rel="noopener" className="flex-1 text-center py-2 rounded-md bg-orange-50 text-orange-700 border border-orange-200 font-semibold no-underline hover:bg-orange-100">📈 AmbitionBox</a></>}
            </div>
            <Field label="Research Notes"><textarea rows={2} value={form.salaryResearch||''} onChange={set('salaryResearch')} placeholder="₹28-40 LPA (Glassdoor)... $150-180K TC (Levels.fyi L5)..." /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Your Floor (min you'd accept)"><input type="number" value={form.salaryMin} onChange={set('salaryMin')} /></Field>
              <Field label="Your Target (ask for this)"><input type="number" value={form.salaryMax} onChange={set('salaryMax')} /></Field>
            </div>

            <SectionHead title="📞 Recruiter Screen" subtitle="Add the screen as Round 1 below, then fill retro after the call." />
            <RoundsView rounds={rounds} expandedRound={expandedRound} setExpandedRound={setExpandedRound} roundForm={roundForm} setRoundForm={setRoundForm} saveRound={saveRound} updateRound={updateRound} deleteRound={deleteRound} defaultType="Recruiter Screen" />
          </div>}

          {/* ═══ STAGE: Interview ═══ */}
          {stage === 'interview' && <div className="space-y-4">
            <SectionHead title="📚 General Prep" subtitle="Applies to ALL rounds. Fill once, review before each." />
            <textarea rows={4} value={form.generalPrep||''} onChange={set('generalPrep')} placeholder="• Company: what they do, news&#10;• Your pitch: 30-sec why you&#10;• Key stories: 3-4 STAR examples&#10;• Projects to highlight&#10;• Questions for them" />

            <SectionHead title={`🎯 Interview Rounds (${rounds.length})`} subtitle="Prep before → Interview → Retro after. Repeat." />
            <RoundsView rounds={rounds} expandedRound={expandedRound} setExpandedRound={setExpandedRound} roundForm={roundForm} setRoundForm={setRoundForm} saveRound={saveRound} updateRound={updateRound} deleteRound={deleteRound} defaultType="Technical" />
          </div>}

          {/* ═══ STAGE: Offer ═══ */}
          {stage === 'offer' && <div className="space-y-4">
            <SectionHead title="🎉 Offer" subtitle="Log comp, equity, deadline. Track negotiation below." />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Offered Min / Base"><input type="number" value={form.salaryMin} onChange={set('salaryMin')} /></Field>
              <Field label="Offered Total Comp"><input type="number" value={form.salaryMax} onChange={set('salaryMax')} /></Field>
            </div>
            <Field label="Offer Details & Negotiation"><textarea rows={4} value={form.notes} onChange={set('notes')} placeholder="Base: ₹X&#10;Equity: Y RSUs&#10;Signing: Z&#10;Deadline: [date]&#10;Counter #1: ..." /></Field>
            {form.status === 'Offer' && <button type="button" className="w-full border-amber-200 text-amber-700 hover:bg-amber-50 py-2" onClick={() => advanceTo('Offer Negotiation')}>↔ Enter Negotiation</button>}
          </div>}

          {/* ═══ Collapsed: Other sections (click to expand) ═══ */}
          {id !== 'new' && stage !== 'apply' && <Collapsible title="📋 Edit Application Info" open={showMore==='info'} toggle={()=>setShowMore(showMore==='info'?null:'info')}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company"><input value={form.company} onChange={set('company')} /></Field>
              <Field label="Role"><input value={form.role} onChange={set('role')} /></Field>
            </div>
            <Field label="Contact"><input value={form.contactName} onChange={set('contactName')} /></Field>
            <Field label="Notes"><textarea rows={2} value={form.notes} onChange={set('notes')} /></Field>
          </Collapsible>}

          {/* Journey */}
          {id !== 'new' && form.statusHistory.length > 0 && <Collapsible title="🗺️ Journey" open={showMore==='journey'} toggle={()=>setShowMore(showMore==='journey'?null:'journey')}>
            {[...form.statusHistory].reverse().map((h, i) => (
              <div key={i} className="flex items-center gap-2 py-1"><span className="w-2 h-2 rounded-full bg-accent" /><span className="font-medium">{h.toStatus}</span><span className="text-muted ml-auto text-sm">{format(new Date(h.timestamp), 'MMM d, HH:mm')}</span></div>
            ))}
          </Collapsible>}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-border flex gap-2">
          <button type="button" className="primary flex-1 py-2.5" onClick={save}>{id === 'new' ? '🚀 Create' : '💾 Save'}</button>
          {id !== 'new' && <button type="button" onClick={() => exportApplicationPDF(id)} className="px-3">📄</button>}
          {id !== 'new' && <button type="button" className="danger px-3" onClick={remove}>🗑</button>}
        </div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}

function SectionHead({ title, subtitle }) {
  return <div><p className="font-bold">{title}</p>{subtitle && <p className="text-sm text-muted">{subtitle}</p>}</div>
}

function Field({ label, required, children }) {
  return <div><label>{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>{children}</div>
}

function Collapsible({ title, open, toggle, children }) {
  return <div className="border border-border rounded-lg overflow-hidden">
    <button type="button" onClick={toggle} className="w-full flex items-center justify-between px-4 py-2.5 bg-bg-secondary/50 border-0 hover:bg-bg-secondary text-left">
      <span className="font-medium text-sm">{title}</span><span className="text-muted">{open ? '▲' : '▼'}</span>
    </button>
    {open && <div className="px-4 py-3 space-y-3 border-t border-border">{children}</div>}
  </div>
}

function RoundsView({ rounds, expandedRound, setExpandedRound, roundForm, setRoundForm, saveRound, updateRound, deleteRound, defaultType }) {
  return <div className="space-y-2">
    {rounds.map((r, i) => (
      <div key={r.id} className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-bg-secondary/30" onClick={() => setExpandedRound(expandedRound === r.id ? null : r.id)}>
          <div className="w-7 h-7 rounded-full bg-violet-600 text-white font-bold flex items-center justify-center shrink-0">{i+1}</div>
          <div className="flex-1">
            <p className="font-medium">{r.type}<span className="text-muted font-normal">{r.medium ? ` · ${r.medium}` : ''}</span></p>
            <p className="text-sm text-muted">{r.date ? format(new Date(r.date), 'EEE, MMM d') : 'TBD'}{r.time ? ` at ${r.time}` : ''}{r.interviewer ? ` · ${r.interviewer}` : ''}</p>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.result==='Passed'?'bg-green-50 text-green-700':r.result==='Failed'?'bg-red-50 text-red-700':'bg-amber-50 text-amber-700'}`}>{r.result||'Pending'}</span>
          <span className="text-muted">{expandedRound===r.id?'▲':'▼'}</span>
        </div>
        {expandedRound === r.id && <div className="border-t border-border space-y-0">
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Field label="Date"><input type="date" value={r.date||''} onChange={e=>updateRound(r,{date:e.target.value})} /></Field>
              <Field label="Time"><input type="time" value={r.time||''} onChange={e=>updateRound(r,{time:e.target.value})} /></Field>
              <Field label="Medium"><select value={r.medium||''} onChange={e=>updateRound(r,{medium:e.target.value})}><option value="">—</option>{INTERVIEW_MEDIUMS.map(m=><option key={m}>{m}</option>)}</select></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Interviewer"><input value={r.interviewer||''} onChange={e=>updateRound(r,{interviewer:e.target.value})} placeholder="Name (Role)" /></Field>
              <Field label="Result"><select value={r.result||'Pending'} onChange={e=>updateRound(r,{result:e.target.value})}><option>Pending</option><option>Passed</option><option>Failed</option></select></Field>
            </div>
          </div>
          <div className="p-3 border-t border-border bg-indigo-50/40">
            <p className="font-semibold text-sm text-indigo-700 mb-1">📚 Prep <span className="font-normal text-indigo-500">— write BEFORE the round</span></p>
            <textarea rows={2} value={r.prep||''} onChange={e=>updateRound(r,{prep:e.target.value})} placeholder="What to study, stories to have ready..." className="bg-white" />
          </div>
          <div className="p-3 border-t border-border bg-emerald-50/40">
            <p className="font-semibold text-sm text-emerald-700 mb-1">📝 Retro <span className="font-normal text-emerald-500">— write IMMEDIATELY after</span></p>
            <textarea rows={2} value={r.retro||''} onChange={e=>updateRound(r,{retro:e.target.value})} placeholder="What went well, what I fumbled, confidence..." className="bg-white" />
          </div>
          <div className="p-2 border-t border-border flex justify-end"><button type="button" onClick={()=>deleteRound(r.id)} className="text-xs text-danger border-danger/30 hover:bg-red-50">🗑 Delete</button></div>
        </div>}
      </div>
    ))}
    {roundForm ? <div className="rounded-lg border-2 border-accent/30 bg-accent/5 p-4 space-y-3">
      <p className="font-bold text-accent">New Round #{rounds.length+1}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><select value={roundForm.type} onChange={e=>setRoundForm(f=>({...f,type:e.target.value}))}>{ROUND_TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="Medium"><select value={roundForm.medium} onChange={e=>setRoundForm(f=>({...f,medium:e.target.value}))}>{INTERVIEW_MEDIUMS.map(m=><option key={m}>{m}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" value={roundForm.date} onChange={e=>setRoundForm(f=>({...f,date:e.target.value}))} /></Field>
        <Field label="Time"><input type="time" value={roundForm.time} onChange={e=>setRoundForm(f=>({...f,time:e.target.value}))} /></Field>
      </div>
      <Field label="Interviewer"><input value={roundForm.interviewer} onChange={e=>setRoundForm(f=>({...f,interviewer:e.target.value}))} /></Field>
      <div className="flex gap-2"><button type="button" className="primary flex-1" onClick={saveRound}>Add</button><button type="button" onClick={()=>setRoundForm(null)}>Cancel</button></div>
    </div> : <button type="button" onClick={()=>setRoundForm({type:defaultType,date:new Date().toISOString().slice(0,10),time:'10:00',medium:'Microsoft Teams',interviewer:'',result:'Pending'})} className="w-full border-2 border-dashed border-border text-muted py-3 hover:border-accent hover:text-accent rounded-lg">+ Add Round</button>}
  </div>
}
