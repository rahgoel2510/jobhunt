import { useState, useEffect } from 'react'
import { store } from '../../lib/store'
import { STATUSES } from '../../lib/constants'
import { format } from 'date-fns'
import ApplicationDrawer from './ApplicationDrawer'
import CompanyLogo from '../shared/CompanyLogo'

const STATUS_COLORS = {
  'Wishlist': 'bg-gray-100 text-gray-700',
  'Applied': 'bg-blue-50 text-blue-700',
  'Referred': 'bg-purple-50 text-purple-700',
  'Recruiter Screen Scheduled': 'bg-cyan-50 text-cyan-700',
  'Recruiter Screen Done': 'bg-teal-50 text-teal-700',
  'Interview Scheduled': 'bg-indigo-50 text-indigo-700',
  'Interview In Progress': 'bg-violet-50 text-violet-700',
  'Offer': 'bg-emerald-50 text-emerald-700',
  'Offer Negotiation': 'bg-amber-50 text-amber-700',
  'Accepted': 'bg-green-50 text-green-800',
  'Rejected': 'bg-red-50 text-red-700',
  'Withdrawn': 'bg-slate-100 text-slate-600',
  'Ghosted': 'bg-orange-50 text-orange-700',
}

export default function Applications() {
  const [apps, setApps] = useState([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [drawerId, setDrawerId] = useState(null)

  const load = () => store.getAll('applications').then(setApps)
  useEffect(() => { load() }, [])

  const filtered = apps.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return (a.company || '').toLowerCase().includes(q) || (a.role || '').toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input className="max-w-xs" placeholder="Search company/role..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="max-w-[180px]" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="primary ml-auto" onClick={() => setDrawerId('new')}>+ Add</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table>
          <thead>
            <tr>
              <th>Company</th><th>Role</th><th>Status</th><th>Applied</th><th>Source</th><th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id} onClick={() => setDrawerId(a.id)}>
                <td className="font-medium"><div className="flex items-center gap-2"><CompanyLogo company={a.company} size={24} />{a.company}</div></td>
                <td>{a.role}</td>
                <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-700'}`}>{a.status}</span></td>
                <td className="text-muted">{a.dateApplied ? format(new Date(a.dateApplied), 'MMM d, yyyy') : ''}</td>
                <td className="text-muted">{a.source || ''}</td>
                <td>{(a.tags || []).map(t => <span key={t} className="inline-block bg-bg-secondary text-muted text-[10px] px-1.5 py-0.5 rounded mr-1">{t}</span>)}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-6">No applications found.</td></tr>}
          </tbody>
        </table>
      </div>

      {drawerId && <ApplicationDrawer id={drawerId} onClose={() => setDrawerId(null)} onSaved={() => { setDrawerId(null); load() }} />}
    </div>
  )
}
