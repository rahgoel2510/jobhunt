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
  async function deleteRound(rid) { if (confirm('Delete this round?')) { await store.delete('interviewRounds', rid); loadRounds() } }

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

  async function remove() { if (confirm('Delete this application and all its data?')) { await store.delete('applications', id); onSaved() } }

  const stageOrder = ['Wishlist', 'Applied', 'Recruiter Screen Scheduled', 'Recruiter Screen Done', 'Interview Scheduled', 'Interview In Progress', 'Offer', 'Accepted']
  const currentIdx = stageOrder.indexOf(form.status)
  const isTerminal = ['Rejected', 'Withdrawn', 'Ghosted'].includes(form.status)
  const linkedResumes = resumes.filter(r => (r.linkedApps || []).includes(id))
  const availableResumes = resumes.filter(r => !(r.linkedApps || []).includes(id))

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-bg-card shadow-2xl rounded-xl flex flex-col animate-[fadeIn_0.15s_ease]" onClick={e => e.stopPropagation()}>

        {/* ═══ Header ═══ */}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <CompanyLogo company={form.company} size={44} />
              <div>
                <h2 className="text-lg font-bold">{form.company || 'New Application'}</h2>
                <p className="text-sm text-muted">{form.role || 'Add your target role'}{form.source ? ` · via ${form.source}` : ''}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full border-0 bg-bg-secondary text-muted text-sm hover:bg-border">✕</button>
          </div>

          {/* Stepper */}
          {id !== 'new' && <div className="flex items-center mt-1">
            {PROCESS_STAGES.map((s, i) => {
              const reached = currentIdx >= i
              const isCurrent = stageOrder[currentIdx] === s.status || (s.status === 'Interview Scheduled' && form.status === 'Interview In Progress')
              return <div key={s.status} className="flex-1 flex flex-col items-center relative">
                {i > 0 && <div className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${reached ? 'bg-accent' : 'bg-border'}`} />}
                <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-base transition-all
                  ${isCurrent ? 'bg-accent text-white shadow-md shadow-accent/30 ring-4 ring-accent/20 scale-110' : reached ? 'bg-accent text-white' : 'bg-bg-secondary text-muted border-2 border-border'}`}>
                  {s.icon}
                </div>
                <span className={`text-[11px] mt-1.5 font-medium ${isCurrent ? 'text-accent font-bold' : reached ? 'text-text-primary' : 'text-muted'}`}>{s.label}</span>
              </div>
            })}
          </div>}
          {isTerminal && <div className="mt-3 text-center"><span className="text-sm font-bold px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">{form.status}</span></div>}
        </div>

        {/* ═══ Body ═══ */}
        <div className="flex-1 overflow-y-auto">

          {/* Advance controls */}
          {id !== 'new' && !isTerminal && currentIdx < stageOrder.length - 1 && <div className="px-6 py-3 border-b border-border bg-accent/5">
            <p className="text-xs text-muted mb-1.5">Ready to move forward? Click to advance this application.</p>
            <div className="flex gap-2">
              <button type="button" className="primary flex-1 py-2" onClick={() => advanceTo(stageOrder[currentIdx + 1])}>
                Advance to → <strong>{stageOrder[currentIdx + 1]}</strong>
              </button>
              <button type="button" className="text-xs border-red-200 text-red-600 hover:bg-red-50 px-3" onClick={() => advanceTo('Rejected')}>Rejected</button>
              {currentIdx < 3 && <button type="button" className="text-xs border-orange-200 text-orange-600 hover:bg-orange-50 px-3" onClick={() => advanceTo('Ghosted')}>Ghosted</button>}
              {currentIdx >= 3 && <button type="button" className="text-xs border-gray-200 text-gray-600 hover:bg-gray-50 px-3" onClick={() => advanceTo('Withdrawn')}>Withdraw</button>}
            </div>
            {form.status === 'Offer' && <button type="button" className="w-full mt-2 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 py-1.5" onClick={() => advanceTo('Offer Negotiation')}>↔ Enter Negotiation</button>}
          </div>}

          {/* ═══ SECTION: Application Info ═══ */}
          {(id === 'new' || currentIdx <= 1) && <Section icon="📋" title="Application Info" help="Start here. Add the company, role, and where you found it.">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company" required help="The company you're applying to">
                <input required value={form.company} onChange={set('company')} placeholder="e.g. Google, Stripe, Razorpay" />
              </Field>
              <Field label="Role Title" required help="Exact title from the job posting">
                <input required value={form.role} onChange={set('role')} placeholder="e.g. Senior Software Engineer" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Status" help="Wishlist = considering, Applied = submitted">
                <select value={form.status} onChange={set('status')}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
              </Field>
              <Field label="Source" help="How you found or got into this role">
                <select value={form.source} onChange={set('source')}><option value="">Select...</option>{SOURCES.map(s => <option key={s}>{s}</option>)}</select>
              </Field>
              <Field label="Date Applied" help="When you submitted or plan to submit">
                <input type="date" value={form.dateApplied} onChange={set('dateApplied')} />
              </Field>
            </div>
            <Field label="Job Description Link" help="Link to the posting — useful for interview prep later">
              <input value={form.jdLink} onChange={set('jdLink')} placeholder="https://careers.company.com/..." />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact Person" help="Recruiter or referral who helped you">
                <input value={form.contactName} onChange={set('contactName')} placeholder="Name (role)" />
              </Field>
              <Field label="Contact Email" help="For follow-ups">
                <input type="email" value={form.contactEmail} onChange={set('contactEmail')} placeholder="recruiter@company.com" />
              </Field>
            </div>
            <Field label="Notes" help="Any context: motivation, red flags, referral details">
              <textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Why this role excites you, anything to remember..." />
            </Field>

            {/* Resume */}
            <div className="rounded-lg bg-bg-secondary p-3 space-y-2">
              <div className="flex items-center gap-1"><span className="text-sm font-semibold">📄 Resume</span><HelpDot text="Which resume version did you use for this application? This helps you track what worked." /></div>
              {linkedResumes.map(r => <div key={r.id} className="flex items-center gap-2 bg-bg-card rounded-md p-2"><span className={`text-xs px-1.5 py-0.5 rounded font-bold ${r.category==='Tailored'?'bg-purple-50 text-purple-700':'bg-sky-50 text-sky-700'}`}>{r.category==='Tailored'?'🎯 Tailored':'📋 General'}</span><span className="text-sm flex-1 truncate">{r.name}</span>{id!=='new'&&<button type="button" onClick={()=>toggleResume(r.id)} className="text-xs text-danger border-0 bg-transparent p-0">Unlink</button>}</div>)}
              {id !== 'new' && availableResumes.length > 0 && <div className="flex flex-wrap gap-1.5">{availableResumes.map(r => <button key={r.id} type="button" onClick={() => toggleResume(r.id)} className="text-xs px-2 py-1 rounded-md bg-bg-card border border-border hover:border-accent hover:text-accent">+ {r.name}</button>)}</div>}
              <div className="flex gap-2 items-center">
                <input placeholder="New resume name (e.g. TPM-v3-AWS-focus)" value={resumeName} onChange={e => setResumeName(e.target.value)} className="flex-1" />
                <select value={resumeCategory} onChange={e => setResumeCategory(e.target.value)} className="w-24"><option>General</option><option>Tailored</option></select>
                <button type="button" onClick={() => fileRef.current?.click()} className="px-2.5 shrink-0">{resumeFile ? `📎 ${resumeFile.name.slice(0,15)}` : '📁 File'}</button>
                <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" onChange={e => setResumeFile(e.target.files[0])} />
                {resumeFile && resumeName && <button type="button" className="primary px-3 shrink-0" onClick={uploadResume}>Upload</button>}
              </div>
            </div>
          </Section>}

          {/* ═══ SECTION: Salary Research ═══ */}
          {id !== 'new' && currentIdx >= 2 && <Section icon="💰" title="Salary Research" help="Do this NOW, before the recruiter screen. They'll ask your expectations early. Research the market range so you don't lowball yourself.">
            <div className="flex gap-2 mb-2">
              {form.company && form.role && <>
                <a href={getGlassdoorUrl(form.company, form.role)} target="_blank" rel="noopener" className="flex-1 text-center text-xs px-2 py-1.5 rounded-md bg-green-50 text-green-700 border border-green-200 font-semibold no-underline hover:bg-green-100">🔍 Glassdoor</a>
                <a href={getLevelsFyiUrl(form.company, form.role)} target="_blank" rel="noopener" className="flex-1 text-center text-xs px-2 py-1.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-semibold no-underline hover:bg-blue-100">📊 Levels.fyi</a>
                <a href={`https://www.ambitionbox.com/salaries/${encodeURIComponent(form.company.toLowerCase().replace(/\s+/g,'-'))}-salaries`} target="_blank" rel="noopener" className="flex-1 text-center text-xs px-2 py-1.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200 font-semibold no-underline hover:bg-orange-100">📈 AmbitionBox</a>
              </>}
            </div>
            <Field label="Research Notes" help="Paste the range you found and the source. e.g. '₹28-40 LPA (Glassdoor, 85 reports)'">
              <textarea rows={2} value={form.salaryResearch || ''} onChange={set('salaryResearch')} placeholder="₹28-40 LPA base (Glassdoor, 85 salaries), $150-180K TC for L5 (Levels.fyi)..." />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Your Ask — Minimum" help="Floor you'd accept. Don't go below this.">
                <input type="number" value={form.salaryMin} onChange={set('salaryMin')} placeholder="e.g. 3000000" />
              </Field>
              <Field label="Your Ask — Target" help="What you'd be happy with. Aim for this.">
                <input type="number" value={form.salaryMax} onChange={set('salaryMax')} placeholder="e.g. 4000000" />
              </Field>
            </div>
          </Section>}

          {/* ═══ SECTION: General Prep ═══ */}
          {id !== 'new' && currentIdx >= 3 && <Section icon="📚" title="General Prep" help="This is your master prep — stuff that applies to ALL rounds for this company. Company research, your story bank picks, key projects to highlight. Fill this once, review before each round.">
            <textarea rows={5} value={form.generalPrep || ''} onChange={set('generalPrep')} placeholder="• Company: [what they do, recent news, culture values]&#10;• Why this role: [your 30-sec pitch]&#10;• Key stories: [STAR stories you'll use]&#10;• Projects: [relevant work to highlight]&#10;• Questions to ask them: [...]" />
          </Section>}

          {/* ═══ SECTION: Interview Rounds ═══ */}
          {id !== 'new' && currentIdx >= 2 && <Section icon="🎯" title={`Interview Rounds (${rounds.length})`} help="Add each round as it gets scheduled. Before: write prep notes. After: write your retro while it's fresh — what went well, what you fumbled, questions you couldn't answer. Your retro feeds prep for the next round.">
            {rounds.map((r, i) => (
              <div key={r.id} className="rounded-lg border border-border overflow-hidden">
                <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-bg-secondary/30 transition-colors" onClick={() => setExpandedRound(expandedRound === r.id ? null : r.id)}>
                  <div className="w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{i+1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{r.type}{r.medium ? <span className="text-muted font-normal"> · {r.medium}</span> : ''}</p>
                    <p className="text-xs text-muted">{r.date ? format(new Date(r.date), 'EEE, MMM d') : 'Date TBD'}{r.time ? ` at ${r.time}` : ''}{r.interviewer ? ` · with ${r.interviewer}` : ''}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.result==='Passed'?'bg-green-50 text-green-700':r.result==='Failed'?'bg-red-50 text-red-700':'bg-amber-50 text-amber-700'}`}>{r.result||'Pending'}</span>
                  <span className="text-muted">{expandedRound===r.id?'▲':'▼'}</span>
                </div>

                {expandedRound === r.id && <div className="border-t border-border">
                  <div className="p-3 space-y-3 bg-bg-secondary/10">
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Date"><input type="date" value={r.date||''} onChange={e => updateRound(r, {date: e.target.value})} /></Field>
                      <Field label="Time"><input type="time" value={r.time||''} onChange={e => updateRound(r, {time: e.target.value})} /></Field>
                      <Field label="Medium" help="Where is this happening?"><select value={r.medium||''} onChange={e => updateRound(r, {medium: e.target.value})}><option value="">Select...</option>{INTERVIEW_MEDIUMS.map(m => <option key={m}>{m}</option>)}</select></Field>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Interviewer" help="Name + role if known"><input value={r.interviewer||''} onChange={e => updateRound(r, {interviewer: e.target.value})} placeholder="Jane Smith (Sr. Eng)" /></Field>
                      <Field label="Result"><select value={r.result||'Pending'} onChange={e => updateRound(r, {result: e.target.value})}><option>Pending</option><option>Passed</option><option>Failed</option></select></Field>
                    </div>
                  </div>

                  {/* Prep */}
                  <div className="p-3 border-t border-border bg-indigo-50/40">
                    <div className="flex items-center gap-1 mb-1"><span className="text-sm font-semibold text-indigo-700">📚 Prep</span><HelpDot text="Write this BEFORE the round. What topics to review, which stories to have ready, technical concepts to brush up on." /></div>
                    <textarea rows={2} value={r.prep||''} onChange={e => updateRound(r, {prep: e.target.value})} placeholder="Topics this round likely covers, stories to prepare, things to review..." className="bg-white" />
                  </div>

                  {/* Retro */}
                  <div className="p-3 border-t border-border bg-emerald-50/40">
                    <div className="flex items-center gap-1 mb-1"><span className="text-sm font-semibold text-emerald-700">📝 Retro</span><HelpDot text="Write this IMMEDIATELY after. What went well, what you fumbled, questions you couldn't answer cleanly. Review this before your next round." /></div>
                    <textarea rows={2} value={r.retro||''} onChange={e => updateRound(r, {retro: e.target.value})} placeholder="What went well · What I fumbled · Questions I couldn't answer · Confidence level..." className="bg-white" />
                  </div>

                  <div className="p-2 border-t border-border flex justify-end">
                    <button type="button" onClick={() => deleteRound(r.id)} className="text-xs text-danger border-danger/30 hover:bg-red-50">🗑 Delete Round</button>
                  </div>
                </div>}
              </div>
            ))}

            {roundForm ? <div className="rounded-lg border-2 border-accent/30 bg-accent/5 p-4 space-y-3">
              <p className="text-sm font-bold text-accent">🆕 New Round #{rounds.length + 1}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Round Type"><select value={roundForm.type} onChange={e => setRoundForm(f=>({...f,type:e.target.value}))}>{ROUND_TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
                <Field label="Medium"><select value={roundForm.medium} onChange={e => setRoundForm(f=>({...f,medium:e.target.value}))}>{INTERVIEW_MEDIUMS.map(m=><option key={m}>{m}</option>)}</select></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date"><input type="date" value={roundForm.date} onChange={e => setRoundForm(f=>({...f,date:e.target.value}))} /></Field>
                <Field label="Time"><input type="time" value={roundForm.time} onChange={e => setRoundForm(f=>({...f,time:e.target.value}))} /></Field>
              </div>
              <Field label="Interviewer (optional)"><input value={roundForm.interviewer} onChange={e => setRoundForm(f=>({...f,interviewer:e.target.value}))} placeholder="Name (Role)" /></Field>
              <div className="flex gap-2"><button type="button" className="primary flex-1" onClick={saveRound}>Add Round</button><button type="button" onClick={() => setRoundForm(null)}>Cancel</button></div>
            </div> : <button type="button" onClick={() => setRoundForm({ type: rounds.length === 0 ? 'Recruiter Screen' : 'Technical', date: new Date().toISOString().slice(0,10), time: '10:00', medium: 'Microsoft Teams', interviewer: '', prep: '', result: 'Pending', retro: '' })} className="w-full border-2 border-dashed border-border text-muted py-3 hover:border-accent hover:text-accent hover:bg-accent/5 transition-colors rounded-lg">
              + Add Interview Round
            </button>}

            {rounds.length === 0 && !roundForm && <p className="text-xs text-muted text-center py-2 italic">No rounds yet. Add one when the recruiter schedules your first call.</p>}
          </Section>}

          {/* ═══ SECTION: Offer Details ═══ */}
          {id !== 'new' && currentIdx >= 6 && <Section icon="🎉" title="Offer Details" help="Log the offer: total comp, equity, signing bonus, deadline to respond. If negotiating, track each counter here.">
            <textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Total comp: ₹X LPA base + Y equity + Z signing&#10;Deadline: [date]&#10;Counter #1: Asked for X, they offered Y&#10;Decision: ..." />
          </Section>}

          {/* ═══ SECTION: Journey ═══ */}
          {id !== 'new' && form.statusHistory.length > 0 && <Section icon="🗺️" title="Journey" help="Your full history with this application. Every status change is recorded automatically.">
            <div className="space-y-1">
              {[...form.statusHistory].reverse().slice(0, 10).map((h, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                  <span className="text-sm font-medium">{h.toStatus}</span>
                  <span className="text-xs text-muted ml-auto">{format(new Date(h.timestamp), 'MMM d, HH:mm')}</span>
                </div>
              ))}
            </div>
          </Section>}
        </div>

        {/* ═══ Footer ═══ */}
        <div className="shrink-0 px-6 py-4 border-t border-border flex gap-2">
          <button type="button" className="primary flex-1 py-2.5 text-sm" onClick={save}>{id === 'new' ? '🚀 Create Application' : '💾 Save Changes'}</button>
          {id !== 'new' && <button type="button" onClick={() => exportApplicationPDF(id)} title="Export as PDF" className="px-3">📄</button>}
          {id !== 'new' && <button type="button" className="danger px-3" onClick={remove} title="Delete permanently">🗑</button>}
        </div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}

function Section({ icon, title, help, children }) {
  return <div className="px-6 py-4 border-b border-border space-y-3">
    <div>
      <div className="flex items-center gap-1.5"><span className="text-base">{icon}</span><span className="text-sm font-bold">{title}</span></div>
      {help && <p className="text-xs text-muted mt-0.5 italic">{help}</p>}
    </div>
    {children}
  </div>
}

function Field({ label, required, help, children }) {
  return <div>
    <label className="flex items-center gap-0.5">
      {label}{required && <span className="text-red-500">*</span>}{help && <HelpDot text={help} />}
    </label>
    {children}
  </div>
}
