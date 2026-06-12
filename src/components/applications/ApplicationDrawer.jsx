import { useState, useEffect, useRef } from 'react'
import { store } from '../../lib/store'
import { exportApplicationPDF } from '../../lib/pdf'
import { STATUSES, SOURCES, PROCESS_STAGES, INTERVIEW_MEDIUMS, ROUND_TYPES, getGlassdoorUrl } from '../../lib/constants'
import { format } from 'date-fns'
import CompanyLogo from '../shared/CompanyLogo'

const emptyApp = { company: '', role: '', jdLink: '', dateApplied: new Date().toISOString().slice(0, 10), status: 'Applied', source: '', contactName: '', contactEmail: '', salaryMin: '', salaryMax: '', notes: '', tags: [], statusHistory: [] }

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
    const rec = { ...roundForm, applicationId: id, roundNumber: roundForm.roundNumber || rounds.length + 1 }
    if (roundForm.id) await store.put('interviewRounds', rec)
    else await store.add('interviewRounds', rec)
    setRoundForm(null); loadRounds()
  }

  async function updateRound(round, updates) {
    await store.put('interviewRounds', { ...round, ...updates })
    loadRounds()
  }

  async function deleteRound(rid) { if (confirm('Delete round?')) { await store.delete('interviewRounds', rid); loadRounds() } }

  async function uploadResume() {
    if (!resumeFile || !resumeName.trim()) return
    const reader = new FileReader()
    reader.onload = async () => { await store.add('resumes', { name: resumeName.trim(), category: resumeCategory, fileName: resumeFile.name, type: resumeFile.type, data: reader.result, linkedApps: id !== 'new' ? [id] : [], createdAt: new Date().toISOString() }); setResumes(await store.getAll('resumes')); setResumeFile(null); setResumeName('') }
    reader.readAsDataURL(resumeFile)
  }

  async function save() {
    const rec = { ...form, salaryMin: Number(form.salaryMin) || null, salaryMax: Number(form.salaryMax) || null }
    if (id === 'new') { if (!rec.statusHistory.length) rec.statusHistory = [{ fromStatus: null, toStatus: rec.status, timestamp: new Date().toISOString() }]; await store.add('applications', rec) }
    else await store.put('applications', rec)
    onSaved()
  }

  async function remove() { if (confirm('Delete?')) { await store.delete('applications', id); onSaved() } }

  // Determine current stage index
  const stageOrder = ['Applied', 'HR Called', 'Screening Done', 'Interview Scheduled', 'Interview In Progress', 'Offer Received', 'Accepted']
  const currentIdx = stageOrder.indexOf(form.status)
  const isTerminal = ['Rejected', 'Withdrawn', 'Ghosted'].includes(form.status)

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-[560px] h-full bg-bg-card shadow-2xl flex flex-col animate-[slideIn_0.2s_ease]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CompanyLogo company={form.company} size={36} />
              <div>
                <h2 className="text-sm font-bold">{form.company || 'New Application'}</h2>
                <p className="text-[11px] text-muted">{form.role || 'Role'}{form.source ? ` · ${form.source}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {form.company && form.role && <a href={getGlassdoorUrl(form.company, form.role)} target="_blank" rel="noopener" className="text-[9px] px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200 font-semibold no-underline hover:bg-green-100">💰 Glassdoor</a>}
              <button onClick={onClose} className="w-7 h-7 rounded-full border-0 bg-bg-secondary text-muted text-xs">✕</button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ═══ Linear Process Tracker ═══ */}
          {id !== 'new' && <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center gap-1">
              {PROCESS_STAGES.slice(0, 6).map((s, i) => {
                const reached = currentIdx >= i
                const isCurrent = stageOrder[currentIdx] === s.status || (s.status === 'Interview Scheduled' && form.status === 'Interview In Progress')
                return (
                  <div key={s.status} className="flex-1 flex flex-col items-center relative">
                    {/* Connector line */}
                    {i > 0 && <div className={`absolute top-3 -left-1/2 w-full h-0.5 ${reached ? 'bg-accent' : 'bg-border'}`} style={{ zIndex: 0 }} />}
                    {/* Node */}
                    <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${isCurrent ? 'bg-accent text-white ring-2 ring-accent/30' : reached ? 'bg-accent text-white' : 'bg-bg-secondary text-muted border border-border'}`}>
                      {reached ? s.icon : i + 1}
                    </div>
                    <p className={`text-[8px] mt-1 text-center ${isCurrent ? 'font-bold text-accent' : reached ? 'text-text-primary' : 'text-muted'}`}>{s.label}</p>
                  </div>
                )
              })}
            </div>
            {isTerminal && <div className="mt-2 text-center"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">{form.status}</span></div>}

            {/* Advance button */}
            {!isTerminal && currentIdx < stageOrder.length - 1 && <div className="mt-3 flex gap-1.5">
              <button type="button" className="primary flex-1 text-[11px]" onClick={() => advanceTo(stageOrder[currentIdx + 1])}>
                Advance → {stageOrder[currentIdx + 1]}
              </button>
              <button type="button" className="text-[10px] border-red-200 text-red-600 hover:bg-red-50" onClick={() => advanceTo('Rejected')}>Reject</button>
              <button type="button" className="text-[10px] border-orange-200 text-orange-600 hover:bg-orange-50" onClick={() => advanceTo('Ghosted')}>Ghost</button>
            </div>}
          </div>}

          {/* ═══ Application Info (new or early stage) ═══ */}
          {(id === 'new' || currentIdx <= 2) && <div className="px-5 py-4 border-b border-border space-y-2">
            <p className="text-[10px] font-bold uppercase text-muted">Application Info</p>
            <div className="grid grid-cols-2 gap-2">
              <div><label>Company *</label><input required value={form.company} onChange={set('company')} /></div>
              <div><label>Role *</label><input required value={form.role} onChange={set('role')} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><label>Source</label><select value={form.source} onChange={set('source')}><option value="">—</option>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label>Date</label><input type="date" value={form.dateApplied} onChange={set('dateApplied')} /></div>
              {id === 'new' && <div><label>Status</label><select value={form.status} onChange={set('status')}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>}
            </div>
            <div><label>JD Link</label><input value={form.jdLink} onChange={set('jdLink')} placeholder="https://..." /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label>Contact</label><input value={form.contactName} onChange={set('contactName')} /></div>
              <div><label>Email</label><input value={form.contactEmail} onChange={set('contactEmail')} /></div>
            </div>
            <div><label>Notes</label><textarea rows={2} value={form.notes} onChange={set('notes')} /></div>
          </div>}

          {/* ═══ Salary + Glassdoor ═══ */}
          {(id === 'new' || currentIdx >= 4) && <div className="px-5 py-4 border-b border-border space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase text-muted">Compensation</p>
              {form.company && form.role && <a href={getGlassdoorUrl(form.company, form.role)} target="_blank" rel="noopener" className="text-[9px] text-green-700 font-semibold no-underline hover:underline">🔍 Research on Glassdoor →</a>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label>Salary Min</label><input type="number" value={form.salaryMin} onChange={set('salaryMin')} placeholder="e.g. 2000000" /></div>
              <div><label>Salary Max</label><input type="number" value={form.salaryMax} onChange={set('salaryMax')} placeholder="e.g. 3000000" /></div>
            </div>
          </div>}

          {/* ═══ Interview Rounds ═══ */}
          {id !== 'new' && currentIdx >= 3 && <div className="px-5 py-4 border-b border-border space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase text-muted">Interview Rounds ({rounds.length})</p>
              <button type="button" onClick={() => setRoundForm({ type: 'Technical', date: new Date().toISOString().slice(0, 10), time: '10:00', medium: 'Microsoft Teams', interviewer: '', prep: '', result: 'Pending', retro: '' })} className="text-[10px] text-accent border-0 bg-transparent p-0 font-semibold">+ Add Round</button>
            </div>

            {rounds.map((r, i) => (
              <div key={r.id} className="rounded-lg border border-border overflow-hidden">
                {/* Round header */}
                <div className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-bg-secondary/50" onClick={() => setExpandedRound(expandedRound === r.id ? null : r.id)}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 bg-violet-600">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold">{r.type}</p>
                    <p className="text-[9px] text-muted">
                      {r.date && format(new Date(r.date), 'MMM d')}
                      {r.time && ` · ${r.time}`}
                      {r.medium && ` · ${r.medium}`}
                      {r.interviewer && ` · ${r.interviewer}`}
                    </p>
                  </div>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${r.result === 'Passed' ? 'bg-green-50 text-green-700' : r.result === 'Failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{r.result || 'Pending'}</span>
                  <span className="text-[10px] text-muted">{expandedRound === r.id ? '▲' : '▼'}</span>
                </div>

                {/* Expanded round detail */}
                {expandedRound === r.id && <div className="p-2.5 border-t border-border space-y-2 bg-bg-secondary/20">
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="text-[9px]">Date</label><input type="date" value={r.date || ''} onChange={e => updateRound(r, { date: e.target.value })} /></div>
                    <div><label className="text-[9px]">Time</label><input type="time" value={r.time || ''} onChange={e => updateRound(r, { time: e.target.value })} /></div>
                    <div><label className="text-[9px]">Medium</label><select value={r.medium || ''} onChange={e => updateRound(r, { medium: e.target.value })}>{INTERVIEW_MEDIUMS.map(m => <option key={m}>{m}</option>)}</select></div>
                  </div>
                  <div><label className="text-[9px]">Interviewer</label><input value={r.interviewer || ''} onChange={e => updateRound(r, { interviewer: e.target.value })} placeholder="Jane (Sr Eng)" /></div>
                  <div><label className="text-[9px]">Result</label><div className="flex gap-1">{['Pending','Passed','Failed'].map(x => <button key={x} type="button" onClick={() => updateRound(r, { result: x })} className={`flex-1 text-[9px] py-1 rounded border ${r.result === x ? (x==='Passed'?'bg-green-50 text-green-700 border-green-200':x==='Failed'?'bg-red-50 text-red-700 border-red-200':'bg-amber-50 text-amber-700 border-amber-200')+' font-bold' : 'bg-transparent text-muted border-border'}`}>{x}</button>)}</div></div>

                  {/* Per-round prep */}
                  <div className="bg-indigo-50/50 rounded-md p-2 space-y-1">
                    <p className="text-[9px] font-bold text-indigo-700 uppercase">📚 Prep for this round</p>
                    <textarea rows={2} value={r.prep || ''} onChange={e => updateRound(r, { prep: e.target.value })} placeholder="Topics to review, questions to prepare, key stories..." className="bg-white" />
                  </div>

                  {/* Per-round retro */}
                  <div className="bg-emerald-50/50 rounded-md p-2 space-y-1">
                    <p className="text-[9px] font-bold text-emerald-700 uppercase">📝 Retrospective</p>
                    <textarea rows={2} value={r.retro || ''} onChange={e => updateRound(r, { retro: e.target.value })} placeholder="How it went, what you learned, what to improve..." className="bg-white" />
                  </div>

                  <button type="button" onClick={() => deleteRound(r.id)} className="text-[9px] text-danger border-0 bg-transparent p-0">🗑 Delete round</button>
                </div>}
              </div>
            ))}

            {/* New round form */}
            {roundForm && <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2">
              <p className="text-[10px] font-bold text-accent">New Round #{rounds.length + 1}</p>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px]">Type</label><select value={roundForm.type} onChange={e => setRoundForm(f => ({ ...f, type: e.target.value }))}>{ROUND_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                <div><label className="text-[9px]">Medium</label><select value={roundForm.medium} onChange={e => setRoundForm(f => ({ ...f, medium: e.target.value }))}>{INTERVIEW_MEDIUMS.map(m => <option key={m}>{m}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px]">Date</label><input type="date" value={roundForm.date} onChange={e => setRoundForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div><label className="text-[9px]">Time</label><input type="time" value={roundForm.time} onChange={e => setRoundForm(f => ({ ...f, time: e.target.value }))} /></div>
              </div>
              <div><label className="text-[9px]">Interviewer</label><input value={roundForm.interviewer} onChange={e => setRoundForm(f => ({ ...f, interviewer: e.target.value }))} placeholder="Name (Role)" /></div>
              <div className="flex gap-1.5"><button type="button" className="primary flex-1 text-[10px]" onClick={saveRound}>Add Round</button><button type="button" className="text-[10px]" onClick={() => setRoundForm(null)}>Cancel</button></div>
            </div>}

            {rounds.length === 0 && !roundForm && <p className="text-[10px] text-muted text-center py-3">No rounds yet. Add one when scheduled.</p>}
          </div>}

          {/* ═══ Resume ═══ */}
          {id !== 'new' && <div className="px-5 py-4 border-b border-border space-y-2">
            <p className="text-[10px] font-bold uppercase text-muted">Resume</p>
            {resumes.filter(r => (r.linkedApps||[]).includes(id)).map(r => (
              <div key={r.id} className="flex items-center gap-2 bg-accent/5 rounded-md p-2">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${r.category === 'Tailored' ? 'bg-purple-50 text-purple-700' : 'bg-sky-50 text-sky-700'}`}>{r.category === 'Tailored' ? '🎯' : '📋'}</span>
                <span className="text-xs flex-1 truncate">{r.name}</span>
              </div>
            ))}
            <div className="flex gap-1.5 items-center">
              <input placeholder="Resume name" value={resumeName} onChange={e => setResumeName(e.target.value)} className="flex-1" />
              <select value={resumeCategory} onChange={e => setResumeCategory(e.target.value)} className="w-20 text-[10px]"><option>General</option><option>Tailored</option></select>
              <button type="button" onClick={() => fileRef.current?.click()} className="text-[10px] px-2">{resumeFile ? '📎' : '📁'}</button>
              <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" onChange={e => setResumeFile(e.target.files[0])} />
              {resumeFile && resumeName && <button type="button" className="primary text-[10px] px-2" onClick={uploadResume}>↑</button>}
            </div>
          </div>}

          {/* ═══ Journey ═══ */}
          {id !== 'new' && form.statusHistory.length > 0 && <div className="px-5 py-4 space-y-1">
            <p className="text-[10px] font-bold uppercase text-muted mb-2">Journey</p>
            {[...form.statusHistory].reverse().slice(0, 6).map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <span className="font-medium">{h.toStatus}</span>
                <span className="text-muted ml-auto">{format(new Date(h.timestamp), 'MMM d, HH:mm')}</span>
              </div>
            ))}
          </div>}
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
