import { useState, useEffect } from 'react'
import { store } from '../../lib/store'
import { STATUSES } from '../../lib/constants'
import { format, differenceInDays } from 'date-fns'
import CompanyLogo from '../shared/CompanyLogo'
import ApplicationDrawer from './ApplicationDrawer'

const STATUS_COLORS = {
  'Wishlist': '#94a3b8', 'Applied': '#3b82f6',
  'Recruiter Screen Scheduled': '#06b6d4', 'Recruiter Screen Done': '#14b8a6',
  'Interview Scheduled': '#6366f1', 'Interview In Progress': '#a855f7',
  'Offer': '#10b981', 'Offer Negotiation': '#f59e0b', 'Accepted': '#22c55e',
  'Rejected': '#ef4444', 'Withdrawn': '#64748b', 'Ghosted': '#f97316',
}

export default function Applications() {
  const [apps, setApps] = useState([])
  const [rounds, setRounds] = useState([])
  const [drawerId, setDrawerId] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')

  const load = async () => {
    setApps(await store.getAll('applications'))
    setRounds(await store.getAll('interviewRounds'))
  }
  useEffect(() => { load() }, [])

  function toggle(id) { setExpanded(e => ({ ...e, [id]: !e[id] })) }

  const filtered = apps.filter(a => {
    if (filter && a.status !== filter) return false
    if (search) { const q = search.toLowerCase(); return (a.company||'').toLowerCase().includes(q) || (a.role||'').toLowerCase().includes(q) }
    return true
  }).sort((a, b) => new Date(b.dateApplied || 0) - new Date(a.dateApplied || 0))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input className="max-w-[200px]" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="max-w-[180px]" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <span className="text-[10px] text-muted">{filtered.length} applications</span>
        <button className="primary ml-auto" onClick={() => setDrawerId('new')}>+ Add</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table>
          <thead>
            <tr>
              <th className="w-6"></th>
              <th>Company</th>
              <th>Role</th>
              <th>Status</th>
              <th>Rounds</th>
              <th>Applied</th>
              <th>Days</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => {
              const appRounds = rounds.filter(r => r.applicationId === a.id).sort((x, y) => (x.roundNumber||0) - (y.roundNumber||0))
              const isOpen = expanded[a.id]
              const days = a.dateApplied ? differenceInDays(new Date(), new Date(a.dateApplied)) : ''
              return (
                <TreeRow key={a.id} app={a} rounds={appRounds} isOpen={isOpen} days={days} toggle={() => toggle(a.id)} onEdit={() => setDrawerId(a.id)} />
              )
            })}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-8 text-xs">No applications.</td></tr>}
          </tbody>
        </table>
      </div>

      {drawerId && <ApplicationDrawer id={drawerId} onClose={() => setDrawerId(null)} onSaved={() => { setDrawerId(null); load() }} />}
    </div>
  )
}

function TreeRow({ app, rounds, isOpen, days, toggle, onEdit }) {
  return <>
    {/* Parent row */}
    <tr className="group">
      <td className="!px-2 !py-1.5">
        <button type="button" onClick={toggle} className="w-5 h-5 flex items-center justify-center rounded border-0 bg-transparent text-muted text-[10px] hover:bg-bg-secondary p-0">
          {rounds.length > 0 ? (isOpen ? '▼' : '▶') : '·'}
        </button>
      </td>
      <td className="!py-1.5 cursor-pointer" onClick={onEdit}>
        <div className="flex items-center gap-2">
          <CompanyLogo company={app.company} size={22} />
          <span className="text-xs font-semibold group-hover:text-accent transition-colors">{app.company}</span>
        </div>
      </td>
      <td className="!py-1.5 text-xs cursor-pointer" onClick={onEdit}>{app.role}</td>
      <td className="!py-1.5">
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: (STATUS_COLORS[app.status] || '#94a3b8') + '18', color: STATUS_COLORS[app.status] || '#94a3b8' }}>{app.status}</span>
      </td>
      <td className="!py-1.5 text-[10px] text-muted">{rounds.length || '—'}</td>
      <td className="!py-1.5 text-[10px] text-muted">{app.dateApplied ? format(new Date(app.dateApplied), 'MMM d') : ''}</td>
      <td className="!py-1.5 text-[10px] text-muted">{days}{days && 'd'}</td>
    </tr>

    {/* Child rows (rounds) */}
    {isOpen && rounds.map((r, i) => (
      <tr key={r.id} className="bg-bg-secondary/30">
        <td className="!px-2 !py-1"></td>
        <td colSpan={6} className="!py-1.5 !pl-10">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-violet-600 text-white text-[8px] font-bold flex items-center justify-center shrink-0">{i+1}</span>
            <span className="text-[11px] font-medium">{r.type}</span>
            {r.medium && <span className="text-[9px] text-muted bg-bg-secondary px-1.5 py-0.5 rounded">{r.medium}</span>}
            {r.date && <span className="text-[9px] text-muted">{format(new Date(r.date), 'MMM d')}{r.time ? ` ${r.time}` : ''}</span>}
            {r.interviewer && <span className="text-[9px] text-muted">· {r.interviewer}</span>}
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ml-auto ${r.result === 'Passed' ? 'bg-green-50 text-green-700' : r.result === 'Failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{r.result || 'Pending'}</span>
          </div>
          {(r.prep || r.retro) && <div className="mt-1 flex gap-3 text-[9px] text-muted pl-6">
            {r.prep && <span>📚 <span className="text-text-primary">{r.prep.slice(0, 60)}{r.prep.length > 60 ? '...' : ''}</span></span>}
            {r.retro && <span>📝 <span className="text-text-primary">{r.retro.slice(0, 60)}{r.retro.length > 60 ? '...' : ''}</span></span>}
          </div>}
        </td>
      </tr>
    ))}

    {/* Separator after expanded */}
    {isOpen && rounds.length > 0 && <tr className="bg-bg-secondary/30"><td colSpan={7} className="!p-0"><div className="h-px bg-border" /></td></tr>}
  </>
}
