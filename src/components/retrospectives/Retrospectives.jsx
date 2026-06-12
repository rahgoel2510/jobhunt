import { useState, useEffect } from 'react'
import { store } from '../../lib/store'
import { format } from 'date-fns'

const ROUND_TYPES = ['phone screen', 'technical', 'behavioral', 'panel', 'final', 'other']

export default function Retrospectives() {
  const [rounds, setRounds] = useState([])
  const [retros, setRetros] = useState([])
  const [apps, setApps] = useState([])
  const [view, setView] = useState('list')
  const [form, setForm] = useState(null)
  const [retroForm, setRetroForm] = useState(null)

  const load = () => Promise.all([store.getAll('interviewRounds').then(setRounds), store.getAll('retrospectives').then(setRetros), store.getAll('applications').then(setApps)])
  useEffect(() => { load() }, [])

  function appName(id) { const a = apps.find(x => x.id === id); return a ? `${a.company} — ${a.role}` : 'Unknown' }

  function startNewRound() { setForm({ applicationId: '', roundNumber: 1, type: 'phone screen', date: new Date().toISOString().slice(0, 10), interviewers: '' }); setView('round') }
  function editRound(r) { setForm(r); setView('round') }

  async function saveRound(e) {
    e.preventDefault()
    const record = { ...form, applicationId: Number(form.applicationId), roundNumber: Number(form.roundNumber) }
    if (form.id) await store.put('interviewRounds', record)
    else await store.add('interviewRounds', record)
    setView('list'); setForm(null); load()
  }

  function startRetro(round) {
    const existing = retros.find(r => r.roundId === round.id)
    if (existing) setRetroForm(existing)
    else setRetroForm({ roundId: round.id, applicationId: round.applicationId, wentWell: '', wentPoorly: '', struggled: '', followUp: '', confidence: 3 })
    setView('retro')
  }

  async function saveRetro(e) {
    e.preventDefault()
    if (retroForm.id) await store.put('retrospectives', retroForm)
    else await store.add('retrospectives', retroForm)
    setView('list'); setRetroForm(null); load()
  }

  async function removeRound(id) {
    if (confirm('Delete this round?')) {
      await store.delete('interviewRounds', id)
      const retro = retros.find(r => r.roundId === id)
      if (retro) await store.delete('retrospectives', retro.id)
      load()
    }
  }

  if (view === 'round' && form) return (
    <div className="card max-w-xl space-y-3">
      <h2 className="text-sm font-semibold">{form.id ? 'Edit Round' : 'New Interview Round'}</h2>
      <form onSubmit={saveRound} className="space-y-3">
        <div><label>Application</label><select required value={form.applicationId} onChange={e => setForm(f => ({ ...f, applicationId: e.target.value }))}><option value="">Select...</option>{apps.map(a => <option key={a.id} value={a.id}>{a.company} — {a.role}</option>)}</select></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label>Round #</label><input type="number" min="1" value={form.roundNumber} onChange={e => setForm(f => ({ ...f, roundNumber: e.target.value }))} /></div>
          <div><label>Type</label><select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>{ROUND_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label>Date</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
        </div>
        <div><label>Interviewer Names/Roles</label><input value={form.interviewers} onChange={e => setForm(f => ({ ...f, interviewers: e.target.value }))} placeholder="e.g. John (Eng Manager), Jane (Sr SDE)" /></div>
        <div className="flex gap-2 pt-2 border-t border-border">
          <button type="submit" className="primary">Save</button>
          <button type="button" onClick={() => { setView('list'); setForm(null) }}>Cancel</button>
        </div>
      </form>
    </div>
  )

  if (view === 'retro' && retroForm) return (
    <div className="card max-w-xl space-y-3">
      <h2 className="text-sm font-semibold">Retrospective</h2>
      <form onSubmit={saveRetro} className="space-y-3">
        <div><label>What went well</label><textarea rows={2} value={retroForm.wentWell} onChange={e => setRetroForm(f => ({ ...f, wentWell: e.target.value }))} /></div>
        <div><label>What went poorly</label><textarea rows={2} value={retroForm.wentPoorly} onChange={e => setRetroForm(f => ({ ...f, wentPoorly: e.target.value }))} /></div>
        <div><label>Questions you struggled with</label><textarea rows={2} value={retroForm.struggled} onChange={e => setRetroForm(f => ({ ...f, struggled: e.target.value }))} /></div>
        <div><label>Follow-up actions</label><textarea rows={2} value={retroForm.followUp} onChange={e => setRetroForm(f => ({ ...f, followUp: e.target.value }))} /></div>
        <div><label>Confidence (1-5): {retroForm.confidence}</label><input type="range" min="1" max="5" value={retroForm.confidence} onChange={e => setRetroForm(f => ({ ...f, confidence: Number(e.target.value) }))} className="w-full h-2 accent-accent" /></div>
        <div className="flex gap-2 pt-2 border-t border-border">
          <button type="submit" className="primary">Save</button>
          <button type="button" onClick={() => { setView('list'); setRetroForm(null) }}>Cancel</button>
        </div>
      </form>
    </div>
  )

  const sortedRounds = [...rounds].sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Interview Rounds & Retrospectives</h2>
        <button className="primary" onClick={startNewRound}>+ Add Round</button>
      </div>
      {sortedRounds.length === 0 && <p className="text-muted text-xs text-center py-8">No interview rounds yet.</p>}
      {sortedRounds.map(r => {
        const retro = retros.find(x => x.roundId === r.id)
        return (
          <div key={r.id} className="card p-3">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-xs">{appName(r.applicationId)}</strong> — Round {r.roundNumber}
                <p className="text-[10px] text-muted">{r.type} · {format(new Date(r.date), 'MMM d, yyyy')}{r.interviewers ? ` · ${r.interviewers}` : ''}</p>
              </div>
              <div className="flex gap-1">
                <button className="border-transparent bg-transparent hover:bg-bg-secondary text-xs" onClick={() => startRetro(r)}>{retro ? '📝 Retro' : '➕ Retro'}</button>
                <button className="border-transparent bg-transparent hover:bg-bg-secondary" onClick={() => editRound(r)}>✏️</button>
                <button className="border-transparent bg-transparent hover:bg-bg-secondary text-danger" onClick={() => removeRound(r.id)}>🗑</button>
              </div>
            </div>
            {retro && <div className="mt-2 bg-bg-secondary rounded-md p-2 text-[11px] space-y-0.5">
              <p><strong>✓ Well:</strong> {retro.wentWell?.slice(0, 80)}</p>
              <p><strong>✗ Poorly:</strong> {retro.wentPoorly?.slice(0, 80)}</p>
              <p><strong>Confidence:</strong> {'★'.repeat(retro.confidence)}{'☆'.repeat(5 - retro.confidence)}</p>
            </div>}
          </div>
        )
      })}
    </div>
  )
}
