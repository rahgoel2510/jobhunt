import { useState, useEffect } from 'react'
import { store } from '../../lib/store'
import { STATUSES, GHOSTED_ELIGIBLE, DEFAULT_GHOSTED_DAYS } from '../../lib/constants'
import { subDays, format, startOfWeek, differenceInDays } from 'date-fns'

const STATUS_COLORS = {
  'Wishlist': '#94a3b8', 'Applied': '#3b82f6', 'Referred': '#8b5cf6',
  'Recruiter Screen Scheduled': '#06b6d4', 'Recruiter Screen Done': '#14b8a6',
  'Interview Scheduled': '#6366f1', 'Interview In Progress': '#a855f7',
  'Offer': '#10b981', 'Offer Negotiation': '#f59e0b',
  'Accepted': '#22c55e', 'Rejected': '#ef4444', 'Withdrawn': '#64748b', 'Ghosted': '#f97316',
}

function DonutChart({ value, max, color, label, sublabel }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  const r = 36, circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <div className="flex flex-col items-center">
      <svg width="90" height="90" className="transform -rotate-90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="var(--color-border)" strokeWidth="7" />
        <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="text-center -mt-[60px] mb-4">
        <p className="text-lg font-bold">{pct}%</p>
        <p className="text-[9px] text-muted">{sublabel}</p>
      </div>
      <p className="text-[10px] font-medium text-muted mt-1">{label}</p>
    </div>
  )
}

function MiniBar({ value, max, color }) {
  const pct = max ? (value / max) * 100 : 0
  return (
    <div className="flex-1 bg-bg-secondary rounded-full h-2.5 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color, minWidth: value ? 4 : 0 }} />
    </div>
  )
}

export default function Dashboard({ onNavigate }) {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [ghostedDays, setGhostedDays] = useState(() => Number(localStorage.getItem('ghostedDays')) || DEFAULT_GHOSTED_DAYS)

  useEffect(() => { store.getAll('applications').then(a => { setApps(a); setLoading(false) }) }, [])
  useEffect(() => { localStorage.setItem('ghostedDays', ghostedDays) }, [ghostedDays])

  if (loading) return <p className="text-muted text-xs p-8 text-center">Loading dashboard...</p>

  const total = apps.length
  const byStatus = {}
  for (const a of apps) byStatus[a.status] = (byStatus[a.status] || 0) + 1

  const responded = apps.filter(a => !['Wishlist', 'Applied'].includes(a.status)).length
  const responseRate = total ? Math.round((responded / total) * 100) : 0
  const interviewStages = ['Interview Scheduled', 'Interview In Progress', 'Offer', 'Offer Negotiation', 'Accepted']
  const interviews = apps.filter(a => interviewStages.includes(a.status)).length
  const offers = (byStatus['Offer'] || 0) + (byStatus['Offer Negotiation'] || 0) + (byStatus['Accepted'] || 0)
  const conversionRate = interviews ? Math.round((offers / interviews) * 100) : 0

  const maxFunnel = Math.max(...STATUSES.map(s => byStatus[s] || 0), 1)

  const stageDurations = {}
  for (const app of apps) {
    const hist = app.statusHistory || []
    for (let i = 0; i < hist.length; i++) {
      const status = hist[i].toStatus
      const start = new Date(hist[i].timestamp)
      const end = i < hist.length - 1 ? new Date(hist[i + 1].timestamp) : new Date()
      const days = differenceInDays(end, start)
      if (!stageDurations[status]) stageDurations[status] = []
      stageDurations[status].push(days)
    }
  }
  const avgDays = {}
  for (const [status, durations] of Object.entries(stageDurations)) {
    avgDays[status] = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
  }

  const ghosted = apps.filter(a => {
    if (!GHOSTED_ELIGIBLE.includes(a.status)) return false
    const hist = a.statusHistory || []
    const lastTransition = hist.length ? new Date(hist[hist.length - 1].timestamp) : new Date(a.dateApplied)
    return differenceInDays(new Date(), lastTransition) >= ghostedDays
  })

  const weeks = []
  for (let i = 7; i >= 0; i--) {
    const weekStart = startOfWeek(subDays(new Date(), i * 7))
    const weekEnd = subDays(weekStart, -7)
    const count = apps.filter(a => { const d = new Date(a.dateApplied); return d >= weekStart && d < weekEnd }).length
    weeks.push({ label: format(weekStart, 'MMM d'), count })
  }
  const maxWeek = Math.max(...weeks.map(w => w.count), 1)

  async function markGhosted(app) {
    const entry = { fromStatus: app.status, toStatus: 'Ghosted', timestamp: new Date().toISOString(), note: `Auto-flagged after ${ghostedDays}+ days` }
    await store.put('applications', { ...app, status: 'Ghosted', statusHistory: [...(app.statusHistory || []), entry] })
    store.getAll('applications').then(setApps)
  }

  // Source distribution
  const bySrc = {}
  for (const a of apps) { const s = a.source || 'Unknown'; bySrc[s] = (bySrc[s] || 0) + 1 }
  const srcColors = { 'Cold Application': '#3b82f6', 'Referral': '#8b5cf6', 'Recruiter Outreach': '#06b6d4', 'Network/Warm Intro': '#f59e0b', 'Unknown': '#94a3b8' }

  return (
    <div className="space-y-4">
      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10" style={{ background: '#6366f1', transform: 'translate(30%, -30%)' }} />
          <p className="text-[10px] uppercase tracking-wider text-muted font-medium">Total</p>
          <p className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">{total}</p>
          <p className="text-[10px] text-muted mt-1">applications tracked</p>
        </div>
        <div className="card p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10" style={{ background: '#10b981', transform: 'translate(30%, -30%)' }} />
          <p className="text-[10px] uppercase tracking-wider text-muted font-medium">Response Rate</p>
          <p className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">{responseRate}%</p>
          <p className="text-[10px] text-muted mt-1">{responded}/{total} got replies</p>
        </div>
        <div className="card p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10" style={{ background: '#f59e0b', transform: 'translate(30%, -30%)' }} />
          <p className="text-[10px] uppercase tracking-wider text-muted font-medium">Interview→Offer</p>
          <p className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">{conversionRate}%</p>
          <p className="text-[10px] text-muted mt-1">{offers}/{interviews} converted</p>
        </div>
        <div className="card p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10" style={{ background: '#f97316', transform: 'translate(30%, -30%)' }} />
          <p className="text-[10px] uppercase tracking-wider text-muted font-medium">Ghosted</p>
          <p className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">{ghosted.length}</p>
          <p className="text-[10px] text-muted mt-1">no reply {ghostedDays}+ days</p>
        </div>
      </div>

      {/* ── Donut Charts Row ── */}
      {total > 0 && <div className="card p-5">
        <div className="flex items-center justify-around flex-wrap gap-4">
          <DonutChart value={responded} max={total} color="#10b981" label="Response Rate" sublabel={`${responded}/${total}`} />
          <DonutChart value={offers} max={Math.max(interviews, 1)} color="#f59e0b" label="Offer Conversion" sublabel={`${offers}/${interviews}`} />
          <DonutChart value={total - (byStatus['Rejected'] || 0) - (byStatus['Withdrawn'] || 0) - (byStatus['Ghosted'] || 0)} max={total} color="#6366f1" label="Active Pipeline" sublabel={`${total - (byStatus['Rejected'] || 0) - (byStatus['Withdrawn'] || 0) - (byStatus['Ghosted'] || 0)} active`} />
        </div>
      </div>}

      {/* ── Ghosted Banner ── */}
      {ghosted.length > 0 && <div className="card border-l-4 border-l-orange-400 p-4" data-testid="ghosted-banner">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold flex items-center gap-1.5">👻 Ghosted Alerts</h3>
          <div className="flex items-center gap-1.5">
            <input type="number" min="1" value={ghostedDays} onChange={e => setGhostedDays(Number(e.target.value))} className="w-12 text-center text-[11px]" />
            <span className="text-[10px] text-muted">days</span>
          </div>
        </div>
        {ghosted.map(a => {
          const hist = a.statusHistory || []
          const last = hist.length ? new Date(hist[hist.length - 1].timestamp) : new Date(a.dateApplied)
          const days = differenceInDays(new Date(), last)
          return (
            <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-xs"><strong>{a.company}</strong> · {a.status} · <span className="text-orange-600 font-semibold">{days}d</span></span>
              </div>
              <button onClick={() => markGhosted(a)} className="text-[10px] px-2 py-0.5 bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100">Mark Ghosted</button>
            </div>
          )
        })}
      </div>}

      {/* ── Pipeline Funnel + Source ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card p-4 md:col-span-2">
          <h3 className="text-xs font-bold mb-3">📊 Pipeline Funnel</h3>
          <div className="space-y-1.5">
            {STATUSES.map(s => (
              <div key={s} className="flex items-center gap-2 group">
                <span className="text-[10px] w-[130px] truncate text-muted group-hover:text-text-primary transition-colors">{s}</span>
                <MiniBar value={byStatus[s] || 0} max={maxFunnel} color={STATUS_COLORS[s]} />
                <span className="text-[11px] font-bold w-6 text-right" style={{ color: STATUS_COLORS[s] }}>{byStatus[s] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4 flex flex-col">
          <h3 className="text-xs font-bold mb-3">🎯 Source Breakdown</h3>
          <div className="flex-1 flex flex-col justify-center space-y-2">
            {Object.entries(bySrc).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
              <div key={src}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-medium">{src}</span>
                  <span className="text-[10px] font-bold" style={{ color: srcColors[src] || '#64748b' }}>{count}</span>
                </div>
                <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(count / total) * 100}%`, backgroundColor: srcColors[src] || '#64748b' }} />
                </div>
              </div>
            ))}
          </div>
          {total === 0 && <p className="text-[10px] text-muted text-center py-4">No data yet</p>}
        </div>
      </div>

      {/* ── Weekly Activity + Avg Days ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card p-4">
          <h3 className="text-xs font-bold mb-3">📈 Weekly Activity</h3>
          <div className="flex items-end gap-1.5 h-28">
            {weeks.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className="w-full rounded-t-md transition-all duration-500 hover:opacity-80" style={{
                  height: `${Math.max((w.count / maxWeek) * 100, w.count ? 8 : 0)}%`,
                  background: `linear-gradient(to top, #6366f1, #a78bfa)`,
                  minHeight: w.count ? 4 : 0
                }} />
                <span className="text-[8px] text-muted mt-1 rotate-[-45deg] origin-top-left w-8">{w.label}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 text-[9px] text-muted">
            <span>8 weeks ago</span><span>This week</span>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-xs font-bold mb-3">⏱ Avg Days per Stage</h3>
          {STATUSES.filter(s => avgDays[s] !== undefined).length > 0 ? (
            <div className="space-y-1.5">
              {STATUSES.filter(s => avgDays[s] !== undefined).map(s => {
                const maxDays = Math.max(...Object.values(avgDays), 1)
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className="text-[10px] w-[110px] truncate text-muted">{s}</span>
                    <div className="flex-1 bg-bg-secondary rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(avgDays[s] / maxDays) * 100}%`, backgroundColor: STATUS_COLORS[s] }} />
                    </div>
                    <span className="text-[10px] font-bold w-8 text-right">{avgDays[s]}d</span>
                  </div>
                )
              })}
            </div>
          ) : <p className="text-[10px] text-muted text-center py-8">Make status changes to see timing data.</p>}
        </div>
      </div>

      {/* ── Recent Learnings ── */}
      {total > 0 && <RecentLearnings />}

      {/* ── Empty state ── */}
      {total === 0 && <div className="card text-center py-12">
        <p className="text-4xl mb-2">🚀</p>
        <p className="text-sm font-medium">Ready to start tracking?</p>
        <p className="text-xs text-muted mt-1 mb-3">Add your first application to see your pipeline come alive.</p>
        <button className="primary" onClick={() => onNavigate('applications')}>Add Application</button>
      </div>}
    </div>
  )
}

function RecentLearnings() {
  const [rounds, setRounds] = useState([])
  const [apps, setApps] = useState([])
  useEffect(() => { store.getAll('interviewRounds').then(setRounds); store.getAll('applications').then(setApps) }, [])
  const withRetros = rounds.filter(r => r.retro).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 5)
  if (withRetros.length === 0) return null
  return (
    <div className="card p-4">
      <h3 className="text-xs font-bold mb-2">💡 Recent Learnings <span className="font-normal text-muted">— from your interview retros</span></h3>
      <div className="space-y-2">
        {withRetros.map(r => {
          const app = apps.find(a => a.id === r.applicationId)
          return <div key={r.id} className="bg-bg-secondary rounded-md p-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold">{app?.company || '?'}</span>
              <span className="text-[10px] text-muted">Round {r.roundNumber} · {r.type}</span>
              {r.date && <span className="text-[10px] text-muted ml-auto">{format(new Date(r.date), 'MMM d')}</span>}
            </div>
            <p className="text-xs text-muted italic">"{r.retro.slice(0, 120)}{r.retro.length > 120 ? '...' : ''}"</p>
          </div>
        })}
      </div>
    </div>
  )
}
