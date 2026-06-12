import { useState, useEffect } from 'react'
import { store } from '../../lib/store'
import { format, isAfter, isBefore, addDays, startOfDay } from 'date-fns'

export default function Timeline() {
  const [rounds, setRounds] = useState([])
  const [apps, setApps] = useState([])

  useEffect(() => { Promise.all([store.getAll('interviewRounds').then(setRounds), store.getAll('applications').then(setApps)]) }, [])

  function appName(id) { const a = apps.find(x => x.id === id); return a ? `${a.company} — ${a.role}` : 'Unknown' }

  const today = startOfDay(new Date())
  const upcoming = rounds.filter(r => isAfter(new Date(r.date), addDays(today, -1))).sort((a, b) => new Date(a.date) - new Date(b.date))
  const past = rounds.filter(r => isBefore(new Date(r.date), today)).sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Interview Timeline</h2>

      <div className="card p-3">
        <h3 className="text-xs font-semibold mb-2">📅 Upcoming</h3>
        {upcoming.length === 0 && <p className="text-muted text-[11px]">No upcoming interviews scheduled.</p>}
        {upcoming.map(r => {
          const daysUntil = Math.ceil((new Date(r.date) - today) / 86400000)
          return (
            <div key={r.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <div className="w-12 text-center">
                <div className="text-lg font-bold text-accent">{format(new Date(r.date), 'd')}</div>
                <div className="text-[10px] text-muted">{format(new Date(r.date), 'MMM')}</div>
              </div>
              <div className="flex-1">
                <strong className="text-xs">{appName(r.applicationId)}</strong>
                <p className="text-[10px] text-muted">Round {r.roundNumber} · {r.type}{r.interviewers ? ` · ${r.interviewers}` : ''}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${daysUntil === 0 ? 'bg-warning text-white' : 'bg-accent-light text-accent'}`}>
                {daysUntil === 0 ? 'Today' : `${daysUntil}d`}
              </span>
            </div>
          )
        })}
      </div>

      {past.length > 0 && <div className="card p-3">
        <h3 className="text-xs font-semibold mb-2">Past Interviews</h3>
        {past.slice(0, 10).map(r => (
          <div key={r.id} className="text-[11px] py-1 border-b border-border last:border-0">
            <span className="text-muted">{format(new Date(r.date), 'MMM d')}</span> — {appName(r.applicationId)} · R{r.roundNumber} ({r.type})
          </div>
        ))}
      </div>}
    </div>
  )
}
