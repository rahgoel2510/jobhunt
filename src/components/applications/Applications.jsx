import { useState, useEffect } from 'react'
import { store } from '../../lib/store'
import { STATUSES } from '../../lib/constants'
import CompanyLogo from '../shared/CompanyLogo'
import ApplicationDrawer from './ApplicationDrawer'
import { format, differenceInDays } from 'date-fns'

const STATUS_COLORS = {
  'Wishlist': '#94a3b8', 'Applied': '#3b82f6',
  'Recruiter Screen Scheduled': '#06b6d4', 'Recruiter Screen Done': '#14b8a6',
  'Interview Scheduled': '#6366f1', 'Interview In Progress': '#a855f7',
  'Offer': '#10b981', 'Offer Negotiation': '#f59e0b', 'Accepted': '#22c55e',
  'Rejected': '#ef4444', 'Withdrawn': '#64748b', 'Ghosted': '#f97316',
}

// Group statuses into pipeline stages for the kanban
const STAGES = [
  { id: 'early', label: '📨 Applied', statuses: ['Wishlist', 'Applied'] },
  { id: 'screening', label: '📞 Screening', statuses: ['Recruiter Screen Scheduled', 'Recruiter Screen Done'] },
  { id: 'interviewing', label: '🎯 Interviews', statuses: ['Interview Scheduled', 'Interview In Progress'] },
  { id: 'offer', label: '🎉 Offer', statuses: ['Offer', 'Offer Negotiation', 'Accepted'] },
  { id: 'closed', label: '📁 Closed', statuses: ['Rejected', 'Withdrawn', 'Ghosted'] },
]

export default function Applications() {
  const [apps, setApps] = useState([])
  const [drawerId, setDrawerId] = useState(null)
  const [view, setView] = useState('board')

  const load = () => store.getAll('applications').then(setApps)
  useEffect(() => { load() }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex bg-bg-secondary rounded-lg p-0.5">
            <button onClick={() => setView('board')} className={`text-[10px] px-2.5 py-1 rounded-md border-0 ${view === 'board' ? 'bg-bg-card shadow-sm font-bold' : 'bg-transparent text-muted'}`}>Board</button>
            <button onClick={() => setView('list')} className={`text-[10px] px-2.5 py-1 rounded-md border-0 ${view === 'list' ? 'bg-bg-card shadow-sm font-bold' : 'bg-transparent text-muted'}`}>List</button>
          </div>
          <span className="text-[10px] text-muted">{apps.length} applications</span>
        </div>
        <button className="primary" onClick={() => setDrawerId('new')}>+ Add</button>
      </div>

      {view === 'board' ? (
        <div className="flex gap-2 overflow-x-auto pb-2" style={{ minHeight: 'calc(100vh - 160px)' }}>
          {STAGES.map(stage => {
            const stageApps = apps.filter(a => stage.statuses.includes(a.status))
            return (
              <div key={stage.id} className="flex-shrink-0 w-56 flex flex-col">
                {/* Column header */}
                <div className="flex items-center gap-1.5 px-2 py-2 rounded-t-lg bg-bg-secondary border border-border border-b-0">
                  <span className="text-xs">{stage.label}</span>
                  <span className="text-[9px] font-bold bg-bg-card px-1.5 py-0.5 rounded-full text-muted">{stageApps.length}</span>
                </div>
                {/* Cards */}
                <div className="flex-1 border border-border border-t-0 rounded-b-lg bg-bg-secondary/30 p-1.5 space-y-1.5 overflow-y-auto">
                  {stageApps.map(a => (
                    <KanbanCard key={a.id} app={a} onClick={() => setDrawerId(a.id)} />
                  ))}
                  {stageApps.length === 0 && <p className="text-[9px] text-muted text-center py-4">Empty</p>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table>
            <thead><tr><th>Company</th><th>Role</th><th>Status</th><th>Applied</th><th>Days</th></tr></thead>
            <tbody>
              {apps.map(a => (
                <tr key={a.id} onClick={() => setDrawerId(a.id)}>
                  <td><div className="flex items-center gap-2"><CompanyLogo company={a.company} size={20} /><span className="font-medium text-xs">{a.company}</span></div></td>
                  <td className="text-xs">{a.role}</td>
                  <td><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[a.status] + '20', color: STATUS_COLORS[a.status] }}>{a.status}</span></td>
                  <td className="text-[10px] text-muted">{a.dateApplied ? format(new Date(a.dateApplied), 'MMM d') : ''}</td>
                  <td className="text-[10px] text-muted">{a.dateApplied ? differenceInDays(new Date(), new Date(a.dateApplied)) + 'd' : ''}</td>
                </tr>
              ))}
              {apps.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-8 text-xs">No applications yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {drawerId && <ApplicationDrawer id={drawerId} onClose={() => setDrawerId(null)} onSaved={() => { setDrawerId(null); load() }} />}
    </div>
  )
}

function KanbanCard({ app, onClick }) {
  const days = app.dateApplied ? differenceInDays(new Date(), new Date(app.dateApplied)) : null
  const hist = app.statusHistory || []
  const lastChange = hist.length > 1 ? differenceInDays(new Date(), new Date(hist[hist.length - 1].timestamp)) : null

  return (
    <div onClick={onClick} className="bg-bg-card rounded-lg border border-border p-2.5 cursor-pointer hover:shadow-md hover:border-accent/30 transition-all group">
      <div className="flex items-start gap-2">
        <CompanyLogo company={app.company} size={24} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold truncate group-hover:text-accent transition-colors">{app.company}</p>
          <p className="text-[10px] text-muted truncate">{app.role}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[app.status] + '20', color: STATUS_COLORS[app.status] }}>{app.status}</span>
        <div className="flex items-center gap-1.5">
          {app.tags?.length > 0 && <span className="text-[8px] bg-accent/10 text-accent px-1 py-0.5 rounded">{app.tags[0]}</span>}
          {days !== null && <span className="text-[9px] text-muted">{days}d</span>}
        </div>
      </div>
      {lastChange !== null && lastChange > 14 && <div className="mt-1.5 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" /><span className="text-[8px] text-orange-600">Stale {lastChange}d</span></div>}
    </div>
  )
}
