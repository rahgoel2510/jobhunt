import { useState, useEffect, useRef } from 'react'
import { store } from '../../lib/store'
import { exportApplicationPDF } from '../../lib/pdf'
import { STATUSES, SOURCES, PROCESS_STAGES, INTERVIEW_MEDIUMS, ROUND_TYPES, getGlassdoorUrl, getLevelsFyiUrl } from '../../lib/constants'
import { format } from 'date-fns'
import CompanyLogo from '../shared/CompanyLogo'

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

  function advanceTo(toStatus) {
    setForm(f => ({ ...f, status: toStatus, statusHistory: [...f.statusHistory, { fromStatus: f.status, toStatus, timestamp: new Date().toISOString() }] }))
  }

  async function saveRound() {
    if (!roundForm) return
    await store.add('interviewRounds', { ...roundForm, applicationId: id, roundNumber: rounds.length + 1 })
    setRoundForm(null); loadRounds()
  }

  async function updateRound(round, updates) { await store.put('interviewRounds', { ...round, ...updates }); loadRounds() }
  async function deleteRound(rid) { if (confirm('Delete round?')) { await store.delete('interviewRounds', rid); loadRounds() } }

  async function uploadResume() {
    if (!resumeFile || !resumeName.trim()) return
    const reader = new FileReader()
    reader.onload = async () => { await store.add('resumes', { name: resumeName.trim(), category: resumeCategory, fileName: resumeFile.name, type: resumeFile.type, data: reader.result, linkedApps: id !== 'new' ? [id] : [], createdAt: new Date().toISOString() }); setResumes(await store.getAll('resumes')); setResumeFile(null); setResumeName('') }
    reader.readAsDataURL(resumeFile)
  }

  async function toggleResume(rid) {
    const r = resumes.find(x => x.id === rid); const l = r.linkedApps || []
    await store.put('resumes', { ...r, linkedApps: l.includes(id) ? l.filter(x => x !== id) : [...l, id] })
    setResumes(await store.getAll('resumes'))
  }

  async function save() {
    const rec = { ...form, salaryMin: Number(form.salaryMin) || null, salaryMax: Number(form.salaryMax) || null }
    if (id === 'new') { if (!rec.statusHistory.length) rec.statusHistory = [{ fromStatus: null, toStatus: rec.status, timestamp: new Date().toISOString() }]; await store.add('applications', rec) }
    else await store.put('applications', rec)
    onSaved()
  }

  async function remove() { if (confirm('Delete?')) { await store.delete('applications', id); onSaved() } }

  const stageOrder = ['Wishlist', 'Applied', 'Recruiter Screen Scheduled', 'Recruiter Screen Done', 'Interview Scheduled', 'Interview In Progress', 'Offer', 'Accepted']
  const currentIdx = stageOrder.indexOf(form.status)
  const isTerminal = ['Rejected', 'Withdrawn', 'Ghosted'].includes(form.status)
  const linkedResumes = resumes.filter(r => (r.linkedApps || []).includes(id))
  const availableResumes = resumes.filter(r => !(r.linkedApps || []).includes(id))

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-[560px] h-full bg-bg-card shadow-2xl flex flex-col animate-[slideIn_0.2s_ease]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <CompanyLogo company={form.company} size={36} />
              <div>
                <h2 className="text-sm font-bold">{form.company || 'New Application'}</h2>
                <p className="text-[11px] text-muted">{form.role || 'Role'}{form.source ? ` · via ${form.source}` : ''}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full border-0 bg-bg-secondary text-muted text-xs">✕</button>
          </div>
          {/* Progress bar */}
          {id !== 'new' && <div className="flex items-center gap-0.5">
            {PROCESS_STAGES.map((s, i) => {
              const reached = currentIdx >= i
              const isCurrent = stageOrder[currentIdx] === s.status || (s.status === 'Interview Scheduled' && form.status === 'Interview In Progress')
              return <div key={s.status} className="flex-1 flex flex-col items-center">
                <div className={`w-full h-1.5 rounded-full ${reached ? 'bg-accent' : 'bg-border'} ${isCurrent ? 'ring-1 ring-accent/50' : ''}`} />
                <span className={`text-[7px] mt-0.5 ${isCurrent ? 'font-bold text-accent' : reached ? 'text-text-primary' : 'text-muted'}`}>{s.label}</span>
              </div>
            })}
          </div>}
          {isTerminal && <div className="mt-1"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">{form.status}</span></div>}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ═══ ADVANCE CONTROLS ═══ */}
          {id !== 'new' && !isTerminal && currentIdx < stageOrder.length - 1 && <div className="px-5 py-3 border-b border-border bg-accent/5">
            <div className="flex gap-1.5">
              <button type="button" className="primary flex-1 text-[11px] py-1.5" onClick={() => advanceTo(stageOrder[currentIdx + 1])}>
                → {stageOrder[currentIdx + 1]}
              </button>
              {currentIdx < 6 && <button type="button" className="text-[10px] border-red-200 text-red-600 hover:bg-red-50 px-2" onClick={() => advanceTo('Rejected')}>Reject</button>}
              {currentIdx < 3 && <button type="button" className="text-[10px] border-orange-200 text-orange-600 hover:bg-orange-50 px-2" onClick={() => advanceTo('Ghosted')}>Ghost</button>}
              {currentIdx >= 3 && <button type="button" className="text-[10px] border-gray-200 text-gray-600 hover:bg-gray-50 px-2" onClick={() => advanceTo('Withdrawn')}>Withdraw</button>}
            </div>
            {form.status === 'Offer' && <button type="button" className="w-full mt-1.5 text-[10px] border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => advanceTo('Offer Negotiation')}>↔ Negotiation</button>}
          </div>}

          {/* ═══ STEP 1: FIND ROLE (Wishlist/Applied) ═══ */}
          {(id === 'new' || currentIdx <= 1) && <Section label="Step 1 · Find & Apply" hint="Company, role, JD, source, resume">
            <div className="grid grid-cols-2 gap-2">
              <div><label>Company *</label><input required value={form.company} onChange={set('company')} /></div>
              <div><label>Role *</label><input required value={form.role} onChange={set('role')} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><label>Status</label><select value={form.status} onChange={set('status')}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label>Source</label><select value={form.source} onChange={set('source')}><option value="">—</option>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label>Date</label><input type="date" value={form.dateApplied} onChange={set('dateApplied')} /></div>
            </div>
            <div><label>JD Link / Text</label><input value={form.jdLink} onChange={set('jdLink')} placeholder="Paste link or job description..." /></div>
            <div><label>Notes</label><textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Why this role? Red flags? Contact info..." /></div>

            {/* Resume — "which resume went where" */}
            <div className="bg-bg-secondary rounded-md p-2.5 space-y-1.5">
              <p className="text-[9px] font-bold uppercase text-muted">📄 Resume Used</p>
              {linkedResumes.map(r => <div key={r.id} className="flex items-center gap-2 text-xs"><span className={`text-[8px] px-1 py-0.5 rounded font-bold ${r.category==='Tailored'?'bg-purple-50 text-purple-700':'bg-sky-50 text-sky-700'}`}>{r.category==='Tailored'?'🎯':'📋'}</span><span className="flex-1 truncate">{r.name}</span>{id!=='new'&&<button type="button" onClick={()=>toggleResume(r.id)} className="text-[8px] text-danger border-0 bg-transparent p-0">✕</button>}</div>)}
              {id !== 'new' && availableResumes.length > 0 && <div className="flex flex-wrap gap-1">{availableResumes.map(r => <button key={r.id} type="button" onClick={() => toggleResume(r.id)} className="text-[9px] px-1.5 py-0.5 rounded bg-bg-card border border-border hover:border-accent hover:text-accent">+ {r.name}</button>)}</div>}
              <div className="flex gap-1 items-center">
                <input placeholder="New resume (e.g. TPM-v3-AWS-focus)" value={resumeName} onChange={e => setResumeName(e.target.value)} className="flex-1" />
                <select value={resumeCategory} onChange={e => setResumeCategory(e.target.value)} className="w-20 text-[9px]"><option>General</option><option>Tailored</option></select>
                <button type="button" onClick={() => fileRef.current?.click()} className="text-[9px] px-1.5">{resumeFile?'📎':'📁'}</button>
                <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" onChange={e => setResumeFile(e.target.files[0])} />
                {resumeFile && resumeName && <button type="button" className="primary text-[9px] px-2" onClick={uploadResume}>↑</button>}
              </div>
            </div>
          </Section>}

          {/* ═══ STEP 3: SALARY RESEARCH (before screen) ═══ */}
          {id !== 'new' && currentIdx >= 2 && <Section label="Step 3 · Salary Research" hint="Do this BEFORE the recruiter asks. Manual lookup.">
            <div className="flex gap-1.5 mb-2">
              {form.company && form.role && <>
                <a href={getGlassdoorUrl(form.company, form.role)} target="_blank" rel="noopener" className="text-[9px] px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200 font-semibold no-underline hover:bg-green-100 flex-1 text-center">Glassdoor</a>
                <a href={getLevelsFyiUrl(form.company, form.role)} target="_blank" rel="noopener" className="text-[9px] px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-semibold no-underline hover:bg-blue-100 flex-1 text-center">Levels.fyi</a>
                <a href={`https://www.ambitionbox.com/salaries/${encodeURIComponent(form.company.toLowerCase().replace(/\s+/g,'-'))}-salaries`} target="_blank" rel="noopener" className="text-[9px] px-2 py-1 rounded-md bg-orange-50 text-orange-700 border border-orange-200 font-semibold no-underline hover:bg-orange-100 flex-1 text-center">AmbitionBox</a>
              </>}
            </div>
            <div><label>Research Notes (range + source)</label><textarea rows={2} value={form.salaryResearch || ''} onChange={set('salaryResearch')} placeholder="e.g. ₹28-40L (Glassdoor), $150-180K (Levels.fyi for L5)..." /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label>Your Ask Min</label><input type="number" value={form.salaryMin} onChange={set('salaryMin')} /></div>
              <div><label>Your Ask Max</label><input type="number" value={form.salaryMax} onChange={set('salaryMax')} /></div>
            </div>
          </Section>}

          {/* ═══ STEP 5: GENERAL PREP (interview phase) ═══ */}
          {id !== 'new' && currentIdx >= 3 && <Section label="Step 5 · General Prep" hint="Common prep for ALL rounds. Fill once, review before each.">
            <textarea rows={4} value={form.generalPrep || ''} onChange={set('generalPrep')} placeholder="Company research, culture values, your STAR stories, key projects to highlight, questions to ask them..." />
          </Section>}

          {/* ═══ INTERVIEW ROUNDS (step 5-7 loop) ═══ */}
          {id !== 'new' && currentIdx >= 2 && <Section label={`Rounds (${rounds.length})`} hint="Each round: date/time/medium, prep before, retro after.">
            {rounds.map((r, i) => (
              <div key={r.id} className="rounded-lg border border-border overflow-hidden">
                <div className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-bg-secondary/30" onClick={() => setExpandedRound(expandedRound === r.id ? null : r.id)}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white bg-violet-600">{i+1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold">{r.type}{r.medium ? ` · ${r.medium}` : ''}</p>
                    <p className="text-[9px] text-muted">{r.date ? format(new Date(r.date), 'MMM d') : ''}{r.time ? ` ${r.time}` : ''}{r.interviewer ? ` · ${r.interviewer}` : ''}</p>
                  </div>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${r.result==='Passed'?'bg-green-50 text-green-700':r.result==='Failed'?'bg-red-50 text-red-700':'bg-amber-50 text-amber-700'}`}>{r.result||'Pending'}</span>
                  <span className="text-[9px] text-muted">{expandedRound===r.id?'▲':'▼'}</span>
                </div>

                {expandedRound === r.id && <div className="border-t border-border">
                  {/* Scheduling */}
                  <div className="p-2.5 space-y-2 bg-bg-secondary/20">
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className="text-[8px]">Date</label><input type="date" value={r.date||''} onChange={e => updateRound(r, {date: e.target.value})} /></div>
                      <div><label className="text-[8px]">Time</label><input type="time" value={r.time||''} onChange={e => updateRound(r, {time: e.target.value})} /></div>
                      <div><label className="text-[8px]">Medium</label><select value={r.medium||''} onChange={e => updateRound(r, {medium: e.target.value})}><option value="">—</option>{INTERVIEW_MEDIUMS.map(m => <option key={m}>{m}</option>)}</select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-[8px]">Interviewer</label><input value={r.interviewer||''} onChange={e => updateRound(r, {interviewer: e.target.value})} /></div>
                      <div><label className="text-[8px]">Result</label><select value={r.result||'Pending'} onChange={e => updateRound(r, {result: e.target.value})}><option>Pending</option><option>Passed</option><option>Failed</option></select></div>
                    </div>
                  </div>

                  {/* Round-specific prep */}
                  <div className="p-2.5 border-t border-border bg-indigo-50/30">
                    <p className="text-[8px] font-bold uppercase text-indigo-700 mb-1">📚 Prep (before this round)</p>
                    <textarea rows={2} value={r.prep||''} onChange={e => updateRound(r, {prep: e.target.value})} placeholder="What this round likely covers, stories to use, technical topics..." className="bg-white" />
                  </div>

                  {/* Retrospective */}
                  <div className="p-2.5 border-t border-border bg-emerald-50/30">
                    <p className="text-[8px] font-bold uppercase text-emerald-700 mb-1">📝 Retro (after this round)</p>
                    <textarea rows={2} value={r.retro||''} onChange={e => updateRound(r, {retro: e.target.value})} placeholder="What went well, what you fumbled, questions you couldn't answer, confidence..." className="bg-white" />
                  </div>

                  <div className="p-2 border-t border-border">
                    <button type="button" onClick={() => deleteRound(r.id)} className="text-[9px] text-danger border-0 bg-transparent p-0">🗑 Delete</button>
                  </div>
                </div>}
              </div>
            ))}

            {roundForm ? <div className="rounded-lg border border-accent/30 bg-accent/5 p-2.5 space-y-2">
              <p className="text-[9px] font-bold text-accent">Round #{rounds.length + 1}</p>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[8px]">Type</label><select value={roundForm.type} onChange={e => setRoundForm(f=>({...f,type:e.target.value}))}>{ROUND_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label className="text-[8px]">Medium</label><select value={roundForm.medium} onChange={e => setRoundForm(f=>({...f,medium:e.target.value}))}>{INTERVIEW_MEDIUMS.map(m=><option key={m}>{m}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[8px]">Date</label><input type="date" value={roundForm.date} onChange={e => setRoundForm(f=>({...f,date:e.target.value}))} /></div>
                <div><label className="text-[8px]">Time</label><input type="time" value={roundForm.time} onChange={e => setRoundForm(f=>({...f,time:e.target.value}))} /></div>
              </div>
              <div><label className="text-[8px]">Interviewer</label><input value={roundForm.interviewer} onChange={e => setRoundForm(f=>({...f,interviewer:e.target.value}))} /></div>
              <div className="flex gap-1.5"><button type="button" className="primary flex-1 text-[10px]" onClick={saveRound}>Add</button><button type="button" className="text-[10px]" onClick={() => setRoundForm(null)}>Cancel</button></div>
            </div> : <button type="button" onClick={() => setRoundForm({ type: rounds.length === 0 ? 'Recruiter Screen' : 'Technical', date: new Date().toISOString().slice(0,10), time: '10:00', medium: 'Microsoft Teams', interviewer: '', prep: '', result: 'Pending', retro: '' })} className="w-full border-dashed border-border text-muted text-[10px] py-2.5 hover:border-accent hover:text-accent">+ Add Round</button>}
          </Section>}

          {/* ═══ STEP 8: OFFER ═══ */}
          {id !== 'new' && currentIdx >= 6 && <Section label="Step 8 · Offer" hint="Comp details, deadline, negotiation log">
            <textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Offer details: total comp, equity, bonus, signing, deadline to respond, counter offers..." />
          </Section>}

          {/* ═══ JOURNEY ═══ */}
          {id !== 'new' && form.statusHistory.length > 0 && <Section label="Journey">
            {[...form.statusHistory].reverse().slice(0, 8).map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <span className="font-medium">{h.toStatus}</span>
                <span className="text-muted ml-auto">{format(new Date(h.timestamp), 'MMM d, HH:mm')}</span>
              </div>
            ))}
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

function Section({ label, hint, children }) {
  return <div className="px-5 py-3 border-b border-border space-y-2">
    <div><p className="text-[10px] font-bold uppercase text-muted">{label}</p>{hint && <p className="text-[9px] text-muted italic">{hint}</p>}</div>
    {children}
  </div>
}
