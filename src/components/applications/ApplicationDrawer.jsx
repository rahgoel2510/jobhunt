import { useState, useEffect, useRef } from 'react'
import { store } from '../../lib/store'
import { exportApplicationPDF } from '../../lib/pdf'
import { STATUSES, SOURCES, PROCESS_STAGES, INTERVIEW_MEDIUMS, ROUND_TYPES, ROUND_RESULTS, getGlassdoorUrl, getLevelsFyiUrl } from '../../lib/constants'
import { format } from 'date-fns'
import CompanyLogo from '../shared/CompanyLogo'

const emptyApp = { company: '', role: '', jdLink: '', jdText: '', dateApplied: new Date().toISOString().slice(0, 10), status: 'Wishlist', source: '', contactName: '', contactEmail: '', salaryMin: '', salaryMax: '', salaryResearch: '', generalPrep: '', notes: '', tags: [], statusHistory: [] }

const STEPS = [
  { id: 'apply', label: 'Apply', icon: '📨', desc: 'Company, role, JD, resume' },
  { id: 'screen', label: 'Screening', icon: '📞', desc: 'Salary research, recruiter call' },
  { id: 'interview', label: 'Interviews', icon: '🎯', desc: 'Rounds, prep, retros' },
  { id: 'offer', label: 'Offer', icon: '🎉', desc: 'Comp, negotiation' },
]

export default function ApplicationDrawer({ id, onClose, onSaved }) {
  const [form, setForm] = useState(emptyApp)
  const [activeStep, setActiveStep] = useState('apply')
  const [rounds, setRounds] = useState([])
  const [roundForm, setRoundForm] = useState(null)
  const [expandedRound, setExpandedRound] = useState(null)
  const [resumes, setResumes] = useState([])
  const [resumeFile, setResumeFile] = useState(null)
  const [resumeName, setResumeName] = useState('')
  const [resumeCategory, setResumeCategory] = useState('General')
  const [tagInput, setTagInput] = useState('')
  const fileRef = useRef()

  useEffect(() => {
    if (id !== 'new') { store.get('applications', id).then(a => { if (a) { setForm({ ...emptyApp, ...a, statusHistory: a.statusHistory || [] }); setActiveStep(getStepForStatus(a.status)) } }); loadRounds() }
    store.getAll('resumes').then(setResumes)
  }, [id])

  function getStepForStatus(status) {
    const idx = ['Wishlist','Applied','Recruiter Screen Scheduled','Recruiter Screen Done','Interview Scheduled','Interview In Progress','Offer','Offer Negotiation','Accepted'].indexOf(status)
    if (idx <= 1) return 'apply'
    if (idx <= 3) return 'screen'
    if (idx <= 5) return 'interview'
    return 'offer'
  }

  async function loadRounds() {
    const all = await store.getAll('interviewRounds')
    setRounds(all.filter(r => r.applicationId === id).sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0)))
  }

  function set(f) { return e => setForm(x => ({ ...x, [f]: e.target.value })) }

  function advanceTo(toStatus) {
    setForm(f => ({ ...f, status: toStatus, statusHistory: [...f.statusHistory, { fromStatus: f.status, toStatus, timestamp: new Date().toISOString() }] }))
    setActiveStep(getStepForStatus(toStatus))
  }

  function undo() {
    if (form.statusHistory.length <= 1) return
    const prev = form.statusHistory[form.statusHistory.length - 2]
    setForm(f => ({ ...f, status: prev.toStatus, statusHistory: f.statusHistory.slice(0, -1) }))
  }

  async function saveRound() { if (!roundForm) return; await store.add('interviewRounds', { ...roundForm, applicationId: id, roundNumber: rounds.length + 1 }); setRoundForm(null); loadRounds() }
  async function updateRound(round, updates) { await store.put('interviewRounds', { ...round, ...updates }); loadRounds() }
  async function deleteRound(rid) { if (confirm('Delete?')) { await store.delete('interviewRounds', rid); loadRounds() } }
  async function uploadResume() { if (!resumeFile || !resumeName.trim()) return; const reader = new FileReader(); reader.onload = async () => { const tags = [form.company, form.role, ...form.tags].filter(Boolean); await store.add('resumes', { name: resumeName.trim(), category: resumeCategory, fileName: resumeFile.name, type: resumeFile.type, data: reader.result, linkedApps: id !== 'new' ? [id] : [], tags, createdAt: new Date().toISOString() }); setResumes(await store.getAll('resumes')); setResumeFile(null); setResumeName('') }; reader.readAsDataURL(resumeFile) }
  async function toggleResume(rid) { const r = resumes.find(x => x.id === rid); const l = r.linkedApps || []; await store.put('resumes', { ...r, linkedApps: l.includes(id) ? l.filter(x => x !== id) : [...l, id] }); setResumes(await store.getAll('resumes')) }
  function addTag() { const t = tagInput.trim(); if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t] })); setTagInput('') }

  async function save() {
    const rec = { ...form, salaryMin: Number(form.salaryMin) || null, salaryMax: Number(form.salaryMax) || null }
    if (id === 'new') { if (!rec.statusHistory.length) rec.statusHistory = [{ fromStatus: null, toStatus: rec.status, timestamp: new Date().toISOString() }]; await store.add('applications', rec) }
    else await store.put('applications', rec)
    onSaved()
  }

  async function remove() { if (confirm('Delete this application permanently?')) { await store.delete('applications', id); onSaved() } }

  const stageOrder = ['Wishlist', 'Applied', 'Recruiter Screen Scheduled', 'Recruiter Screen Done', 'Interview Scheduled', 'Interview In Progress', 'Offer', 'Accepted']
  const currentIdx = stageOrder.indexOf(form.status)
  const isTerminal = ['Rejected', 'Withdrawn', 'Ghosted'].includes(form.status)
  const linkedResumes = resumes.filter(r => (r.linkedApps || []).includes(id))
  const availableResumes = resumes.filter(r => !(r.linkedApps || []).includes(id))

  return (
    <div className="fixed inset-0 z-[100] bg-bg flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-bg-card gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CompanyLogo company={form.company} size={28} />
          <div className="min-w-0">
            <h1 className="font-bold text-sm md:text-base truncate">{form.company || 'New Application'} <span className="text-muted font-normal">· {form.role || 'Role'}</span></h1>
            <p className="text-xs text-muted truncate">{form.status}{form.source ? ` · ${form.source}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {form.statusHistory.length > 1 && <button type="button" onClick={undo} title="Undo last status change" className="!min-h-0 !py-1.5 text-xs px-2 border-amber-200 text-amber-700 hover:bg-amber-50">↩</button>}
          <button type="button" className="primary !min-h-0 !py-1.5 px-3 text-sm" onClick={save}>{id === 'new' ? '🚀 Create' : '💾 Save'}</button>
          {id !== 'new' && <button type="button" onClick={() => exportApplicationPDF(id)} className="!min-h-0 !py-1.5 px-2">📄</button>}
          {id !== 'new' && <button type="button" className="danger !min-h-0 !py-1.5 px-2" onClick={remove}>🗑</button>}
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-bg-secondary text-muted hover:bg-border border-0 !min-h-0 !p-0">✕</button>
        </div>
      </div>

      {/* Mobile step tabs */}
      <div className="md:hidden shrink-0 flex border-b border-border bg-bg-card overflow-x-auto">
        {STEPS.map(step => (
          <button key={step.id} type="button" onClick={() => setActiveStep(step.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 border-0 rounded-none !min-h-0 whitespace-nowrap ${activeStep === step.id ? 'text-accent border-b-2 border-b-accent' : 'text-muted'}`}>
            <span className="text-base">{step.icon}</span>
            <span className="text-[10px] font-medium">{step.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar — desktop only */}
        <nav className="hidden md:flex shrink-0 w-56 border-r border-border bg-bg-card p-4 flex-col space-y-1 overflow-y-auto">
          {STEPS.map((step, i) => {
            const stepIdx = i
            const currentStepIdx = STEPS.findIndex(s => s.id === getStepForStatus(form.status))
            const reached = stepIdx <= currentStepIdx
            const isActive = activeStep === step.id
            return (
              <button key={step.id} type="button" onClick={() => setActiveStep(step.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border-0 transition-all ${isActive ? 'bg-accent/10 text-accent ring-1 ring-accent/30' : reached ? 'bg-bg-secondary hover:bg-accent/5' : 'bg-transparent text-muted hover:bg-bg-secondary'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{step.icon}</span>
                  <div>
                    <p className={`text-sm font-semibold ${isActive ? 'text-accent' : reached ? '' : 'text-muted'}`}>{step.label}</p>
                    <p className="text-[11px] text-muted">{step.desc}</p>
                  </div>
                </div>
                {reached && stepIdx < currentStepIdx && <span className="text-[10px] text-green-600 font-medium ml-7">✓ Done</span>}
              </button>
            )
          })}

          {/* Status advance in sidebar */}
          {id !== 'new' && <div className="pt-3 mt-3 border-t border-border space-y-1.5">
            <p className="text-[11px] font-bold uppercase text-muted px-1">Move to</p>
            {!isTerminal && currentIdx < stageOrder.length - 1 && <button type="button" className="w-full primary text-xs py-2 text-left px-3" onClick={() => advanceTo(stageOrder[currentIdx + 1])}>→ {stageOrder[currentIdx + 1]}</button>}
            {!isTerminal && <button type="button" className="w-full text-xs py-1.5 text-left px-3 border-red-200 text-red-600 hover:bg-red-50" onClick={() => advanceTo('Rejected')}>✕ Rejected</button>}
            {!isTerminal && currentIdx < 4 && <button type="button" className="w-full text-xs py-1.5 text-left px-3 border-orange-200 text-orange-600 hover:bg-orange-50" onClick={() => advanceTo('Ghosted')}>👻 Ghosted</button>}
            {!isTerminal && currentIdx >= 4 && <button type="button" className="w-full text-xs py-1.5 text-left px-3 border-gray-200 text-gray-600 hover:bg-gray-50" onClick={() => advanceTo('Withdrawn')}>← Withdrawn</button>}
          </div>}

          {/* Journey */}
          {id !== 'new' && form.statusHistory.length > 0 && <div className="pt-3 mt-3 border-t border-border">
            <p className="text-[11px] font-bold uppercase text-muted px-1 mb-1">Journey</p>
            {[...form.statusHistory].reverse().slice(0, 6).map((h, i) => (
              <div key={i} className="flex items-center gap-1.5 py-0.5 px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <span className="text-[11px] truncate">{h.toStatus}</span>
                <span className="text-[10px] text-muted ml-auto">{format(new Date(h.timestamp), 'MMM d')}</span>
              </div>
            ))}
          </div>}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-2xl mx-auto space-y-5">

            {/* ═══ STEP: APPLY ═══ */}
            {activeStep === 'apply' && <>
              <StepHeader title="📨 Application Details" desc="Fill in the basics. Which company, what role, where you found it, and which resume you're sending." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Company *"><input required value={form.company} onChange={set('company')} placeholder="e.g. Google" /></Field>
                <Field label="Role *"><input required value={form.role} onChange={set('role')} placeholder="e.g. Senior SDE" /></Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Status"><select value={form.status} onChange={set('status')}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></Field>
                <Field label="Source"><select value={form.source} onChange={set('source')}><option value="">—</option>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></Field>
                <Field label="Date Applied"><input type="date" value={form.dateApplied} onChange={set('dateApplied')} /></Field>
              </div>
              <Field label="JD Link"><input value={form.jdLink} onChange={set('jdLink')} placeholder="https://..." /></Field>
              <Field label="JD Text (paste if no link)">
                <textarea rows={4} value={form.jdText || ''} onChange={set('jdText')} placeholder="Paste the full job description here if you received it via email or don't have a direct link..." />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Contact Person"><input value={form.contactName} onChange={set('contactName')} placeholder="Recruiter / referral name" /></Field>
                <Field label="Contact Email"><input value={form.contactEmail} onChange={set('contactEmail')} placeholder="recruiter@company.com" /></Field>
              </div>
              <Field label="Notes"><textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Why this role? Motivation, red flags, referral context..." /></Field>
              <Field label="Tags">
                <div className="flex gap-2"><input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Type & press Enter (e.g. remote, FAANG)" className="flex-1" /><button type="button" onClick={addTag}>+</button></div>
                {form.tags.length > 0 && <div className="flex gap-1.5 flex-wrap mt-2">{form.tags.map(t => <span key={t} className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs cursor-pointer hover:bg-red-100 hover:text-red-600" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))}>{t} ✕</span>)}</div>}
              </Field>

              {/* Resume */}
              <div className="rounded-lg bg-bg-secondary p-4 space-y-2">
                <p className="font-semibold">📄 Resume — which version are you sending?</p>
                {linkedResumes.map(r => <div key={r.id} className="flex items-center gap-2 bg-bg-card rounded-md p-2"><span className={`text-xs px-1.5 py-0.5 rounded font-bold ${r.category==='Tailored'?'bg-purple-50 text-purple-700':'bg-sky-50 text-sky-700'}`}>{r.category==='Tailored'?'🎯 Tailored':'📋 General'}</span><span className="flex-1">{r.name}</span>{id!=='new'&&<button type="button" onClick={()=>toggleResume(r.id)} className="text-xs text-danger border-0 bg-transparent">Unlink</button>}</div>)}
                {id!=='new'&&availableResumes.length>0&&<div className="flex flex-wrap gap-1.5">{availableResumes.map(r=><button key={r.id} type="button" onClick={()=>toggleResume(r.id)} className="text-xs px-2 py-1 rounded-md bg-bg-card border border-border hover:border-accent hover:text-accent">+ {r.name}</button>)}</div>}
                <div className="flex gap-2 items-center"><input placeholder="Upload new (e.g. TPM-v3-AWS)" value={resumeName} onChange={e=>setResumeName(e.target.value)} className="flex-1" /><select value={resumeCategory} onChange={e=>setResumeCategory(e.target.value)} className="w-24"><option>General</option><option>Tailored</option></select><button type="button" onClick={()=>fileRef.current?.click()} className="px-2">{resumeFile?'📎 '+resumeFile.name.slice(0,12):'📁 File'}</button><input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" onChange={e=>setResumeFile(e.target.files[0])} />{resumeFile&&resumeName&&<button type="button" className="primary px-3" onClick={uploadResume}>Upload</button>}</div>
              </div>
            </>}

            {/* ═══ STEP: SCREENING ═══ */}
            {activeStep === 'screen' && <>
              <StepHeader title="📞 Recruiter Screen" desc="Research salary BEFORE the call. Add the screen as Round 1 below. Fill retro after." />

              <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-3">
                <p className="font-semibold text-green-800">💰 Salary Research — do this before they ask</p>
                <div className="flex gap-2">
                  {form.company&&form.role&&<><a href={getGlassdoorUrl(form.company,form.role)} target="_blank" rel="noopener" className="flex-1 text-center py-2 rounded-md bg-white text-green-700 border border-green-300 font-semibold no-underline hover:bg-green-100">Glassdoor</a><a href={getLevelsFyiUrl(form.company,form.role)} target="_blank" rel="noopener" className="flex-1 text-center py-2 rounded-md bg-white text-blue-700 border border-blue-300 font-semibold no-underline hover:bg-blue-100">Levels.fyi</a><a href={`https://www.ambitionbox.com/salaries/${encodeURIComponent(form.company.toLowerCase().replace(/\s+/g,'-'))}-salaries`} target="_blank" rel="noopener" className="flex-1 text-center py-2 rounded-md bg-white text-orange-700 border border-orange-300 font-semibold no-underline hover:bg-orange-100">AmbitionBox</a></>}
                </div>
                <Field label="Research Notes (range + source link)"><textarea rows={2} value={form.salaryResearch||''} onChange={set('salaryResearch')} placeholder="₹28-40 LPA (Glassdoor, 85 reports)&#10;$150-180K TC for L5 (Levels.fyi)" /></Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Your Floor (min)"><input type="number" value={form.salaryMin} onChange={set('salaryMin')} placeholder="e.g. 2800000" /></Field>
                  <Field label="Your Target"><input type="number" value={form.salaryMax} onChange={set('salaryMax')} placeholder="e.g. 4000000" /></Field>
                </div>
              </div>

              <p className="font-semibold mt-4">📞 Screen Round</p>
              <p className="text-sm text-muted">Add the recruiter call as Round 1. After the call, expand it and fill the retro.</p>
              <RoundsUI rounds={rounds} expandedRound={expandedRound} setExpandedRound={setExpandedRound} roundForm={roundForm} setRoundForm={setRoundForm} saveRound={saveRound} updateRound={updateRound} deleteRound={deleteRound} defaultType="Recruiter Screen" />
            </>}

            {/* ═══ STEP: INTERVIEW ═══ */}
            {activeStep === 'interview' && <>
              <StepHeader title="🎯 Interview Loop" desc="General prep once. Then for each round: prep before → interview → retro after. Review last retro before next prep." />

              <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-4">
                <p className="font-semibold text-indigo-800 mb-2">📚 General Prep — applies to all rounds</p>
                <textarea rows={5} value={form.generalPrep||''} onChange={set('generalPrep')} placeholder="• Company: what they do, culture, recent news&#10;• Your 30-sec pitch for this role&#10;• 3-4 STAR stories (pick from story bank)&#10;• Key projects to highlight&#10;• Questions to ask them" className="bg-white" />
              </div>

              <p className="font-semibold mt-2">Rounds</p>
              <RoundsUI rounds={rounds} expandedRound={expandedRound} setExpandedRound={setExpandedRound} roundForm={roundForm} setRoundForm={setRoundForm} saveRound={saveRound} updateRound={updateRound} deleteRound={deleteRound} defaultType="Technical" />
            </>}

            {/* ═══ STEP: OFFER ═══ */}
            {activeStep === 'offer' && <>
              <StepHeader title="🎉 Offer & Negotiation" desc="Log the offer, track negotiation rounds, make your decision." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Offered Base / Min"><input type="number" value={form.salaryMin} onChange={set('salaryMin')} /></Field>
                <Field label="Total Comp"><input type="number" value={form.salaryMax} onChange={set('salaryMax')} /></Field>
              </div>
              <Field label="Offer Details & Negotiation Log"><textarea rows={5} value={form.notes} onChange={set('notes')} placeholder="Base: ₹X LPA&#10;Equity: Y RSUs over 4 years&#10;Signing: Z&#10;Deadline: [date]&#10;&#10;Counter #1: Asked for X, they came back with Y&#10;Counter #2: ..." /></Field>
            </>}
          </div>
        </main>
      </div>
    </div>
  )
}

function StepHeader({ title, desc }) {
  return <div className="mb-2"><h2 className="text-lg font-bold">{title}</h2><p className="text-sm text-muted">{desc}</p></div>
}

function Field({ label, children }) {
  return <div><label>{label}</label>{children}</div>
}

function RoundsUI({ rounds, expandedRound, setExpandedRound, roundForm, setRoundForm, saveRound, updateRound, deleteRound, defaultType }) {
  return <div className="space-y-2">
    {rounds.map((r, i) => (
      <div key={r.id} className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-bg-secondary/30" onClick={() => setExpandedRound(expandedRound === r.id ? null : r.id)}>
          <div className="w-8 h-8 rounded-full bg-violet-600 text-white font-bold flex items-center justify-center shrink-0">{i+1}</div>
          <div className="flex-1">
            <p className="font-medium">{r.type}<span className="text-muted font-normal">{r.medium ? ` · ${r.medium}` : ''}</span></p>
            <p className="text-sm text-muted">{r.date ? format(new Date(r.date), 'EEE, MMM d') : 'TBD'}{r.time ? ` at ${r.time}` : ''}{r.interviewer ? ` · ${r.interviewer}` : ''}</p>
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${r.result==='Selected'||r.result==='Move to Next Round'?'bg-green-50 text-green-700':r.result==='Rejected'?'bg-red-50 text-red-700':r.result==='Completed'?'bg-blue-50 text-blue-700':'bg-amber-50 text-amber-700'}`}>{r.result||'Scheduled'}</span>
          <span className="text-muted text-lg">{expandedRound===r.id?'▲':'▼'}</span>
        </div>
        {expandedRound === r.id && <div className="border-t border-border">
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Date"><input type="date" value={r.date||''} onChange={e=>updateRound(r,{date:e.target.value})} /></Field>
              <Field label="Time"><input type="time" value={r.time||''} onChange={e=>updateRound(r,{time:e.target.value})} /></Field>
              <Field label="Medium"><select value={r.medium||''} onChange={e=>updateRound(r,{medium:e.target.value})}><option value="">—</option>{INTERVIEW_MEDIUMS.map(m=><option key={m}>{m}</option>)}</select></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Interviewer"><input value={r.interviewer||''} onChange={e=>updateRound(r,{interviewer:e.target.value})} placeholder="Name (Role)" /></Field>
              <Field label="Result">
                <select value={r.result||'Scheduled'} onChange={e=>updateRound(r,{result:e.target.value})}>{ROUND_RESULTS.map(x=><option key={x}>{x}</option>)}</select>
                <p className="text-[11px] text-muted mt-1 italic">
                  {r.result === 'Scheduled' && '⏳ Round is booked, hasn\'t happened yet'}
                  {r.result === 'Completed' && '✅ Done, awaiting feedback from interviewer'}
                  {r.result === 'Move to Next Round' && '🎉 Passed! Advancing to the next round'}
                  {r.result === 'Selected' && '🏆 Final selection — you got the offer!'}
                  {r.result === 'Rejected' && '❌ Didn\'t make it past this round'}
                  {!r.result && '⏳ Round is booked, hasn\'t happened yet'}
                </p>
              </Field>
            </div>
          </div>
          <div className="p-4 border-t border-border bg-indigo-50/50">
            <p className="font-semibold text-indigo-700 mb-1">📚 Prep — write BEFORE this round</p>
            <p className="text-xs text-indigo-600 mb-2">What topics will this round cover? Which stories should you have ready?</p>
            <textarea rows={3} value={r.prep||''} onChange={e=>updateRound(r,{prep:e.target.value})} placeholder="Topics to review, stories to prepare, technical concepts..." className="bg-white" />
          </div>
          <div className="p-4 border-t border-border bg-emerald-50/50">
            <p className="font-semibold text-emerald-700 mb-1">📝 Retro — write IMMEDIATELY after</p>
            <p className="text-xs text-emerald-600 mb-2">While it's fresh: what went well, what you fumbled, questions you couldn't answer cleanly.</p>
            <textarea rows={3} value={r.retro||''} onChange={e=>updateRound(r,{retro:e.target.value})} placeholder="✓ Went well:&#10;✗ Fumbled:&#10;? Couldn't answer:&#10;Confidence: /5" className="bg-white" />
          </div>
          <div className="p-3 border-t border-border flex justify-end"><button type="button" onClick={()=>deleteRound(r.id)} className="text-sm text-danger border-danger/30 hover:bg-red-50">🗑 Delete Round</button></div>
        </div>}
      </div>
    ))}
    {roundForm ? <div className="rounded-lg border-2 border-accent/30 bg-accent/5 p-4 space-y-3">
      <p className="font-bold text-accent">New Round #{rounds.length+1}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Type"><select value={roundForm.type} onChange={e=>setRoundForm(f=>({...f,type:e.target.value}))}>{ROUND_TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="Medium"><select value={roundForm.medium} onChange={e=>setRoundForm(f=>({...f,medium:e.target.value}))}>{INTERVIEW_MEDIUMS.map(m=><option key={m}>{m}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Date"><input type="date" value={roundForm.date} onChange={e=>setRoundForm(f=>({...f,date:e.target.value}))} /></Field>
        <Field label="Time"><input type="time" value={roundForm.time} onChange={e=>setRoundForm(f=>({...f,time:e.target.value}))} /></Field>
      </div>
      <Field label="Interviewer"><input value={roundForm.interviewer} onChange={e=>setRoundForm(f=>({...f,interviewer:e.target.value}))} placeholder="Name (Role)" /></Field>
      <div className="flex gap-2"><button type="button" className="primary flex-1" onClick={saveRound}>Add Round</button><button type="button" onClick={()=>setRoundForm(null)}>Cancel</button></div>
    </div> : <button type="button" onClick={()=>setRoundForm({type:defaultType,date:new Date().toISOString().slice(0,10),time:'10:00',medium:'Microsoft Teams',interviewer:'',result:'Scheduled'})} className="w-full border-2 border-dashed border-border text-muted py-4 hover:border-accent hover:text-accent rounded-lg text-sm">+ Add Interview Round</button>}
  </div>
}
