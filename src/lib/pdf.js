import { store } from './store'
import { format } from 'date-fns'

export async function exportApplicationPDF(appId) {
  const app = await store.get('applications', appId)
  if (!app) return

  const [allRounds, allRetros, allGuides, allResumes] = await Promise.all([
    store.getAll('interviewRounds'),
    store.getAll('retrospectives'),
    store.getAll('prepGuides'),
    store.getAll('resumes'),
  ])

  const rounds = allRounds.filter(r => r.applicationId === appId).sort((a, b) => a.roundNumber - b.roundNumber)
  const retros = allRetros.filter(r => r.applicationId === appId)
  const guides = allGuides.filter(g => g.applicationId === appId)
  const resumes = allResumes.filter(r => (r.linkedApps || []).includes(appId))

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${app.company} - ${app.role}</title>
<style>body{font-family:-apple-system,sans-serif;max-width:700px;margin:2rem auto;line-height:1.6;color:#1a1a1a}
h1{border-bottom:2px solid #2563eb;padding-bottom:0.5rem}h2{margin-top:1.5rem;color:#2563eb}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;background:#f5f5f5;padding:1rem;border-radius:8px}
.section{margin-top:1rem;padding:1rem;border:1px solid #e0e0e0;border-radius:8px}
pre{white-space:pre-wrap;background:#f5f5f5;padding:0.75rem;border-radius:4px;font-size:0.85rem}
@media print{body{margin:0}}</style></head><body>
<h1>${app.company} — ${app.role}</h1>
<div class="meta">
<div><strong>Status:</strong> ${app.status}</div>
<div><strong>Applied:</strong> ${app.dateApplied ? format(new Date(app.dateApplied), 'MMM d, yyyy') : 'N/A'}</div>
<div><strong>Source:</strong> ${app.source || 'N/A'}</div>
<div><strong>Contact:</strong> ${app.contactName || 'N/A'}${app.contactEmail ? ` (${app.contactEmail})` : ''}</div>
${app.salaryMin || app.salaryMax ? `<div><strong>Salary:</strong> ${app.salaryMin || '?'}–${app.salaryMax || '?'}</div>` : ''}
${(app.tags || []).length ? `<div><strong>Tags:</strong> ${app.tags.join(', ')}</div>` : ''}
</div>
${app.notes ? `<h2>Notes</h2><pre>${app.notes}</pre>` : ''}
${resumes.length ? `<h2>Resume Versions</h2>${resumes.map(r => `<p>📄 ${r.name} (${r.fileName})</p>`).join('')}` : ''}
${guides.length ? guides.map(g => `<h2>Prep Guide</h2>
${g.companyResearch ? `<div class="section"><strong>Company Research</strong><pre>${g.companyResearch}</pre></div>` : ''}
${g.talkingPoints ? `<div class="section"><strong>Talking Points</strong><pre>${g.talkingPoints}</pre></div>` : ''}
${g.anticipatedQuestions ? `<div class="section"><strong>Anticipated Questions</strong><pre>${g.anticipatedQuestions}</pre></div>` : ''}
${g.storyBankLinks ? `<div class="section"><strong>Story Bank</strong><pre>${g.storyBankLinks}</pre></div>` : ''}
`).join('') : ''}
${rounds.length ? `<h2>Interview Rounds</h2>${rounds.map(r => {
    const retro = retros.find(x => x.roundId === r.id)
    return `<div class="section"><strong>Round ${r.roundNumber}: ${r.type}</strong> — ${format(new Date(r.date), 'MMM d, yyyy')}${r.interviewers ? `<br>Interviewers: ${r.interviewers}` : ''}
${retro ? `<br><br><strong>Retrospective</strong> (Confidence: ${'★'.repeat(retro.confidence)}${'☆'.repeat(5 - retro.confidence)})
${retro.wentWell ? `<br>✓ Went well: ${retro.wentWell}` : ''}
${retro.wentPoorly ? `<br>✗ Went poorly: ${retro.wentPoorly}` : ''}
${retro.struggled ? `<br>❓ Struggled: ${retro.struggled}` : ''}
${retro.followUp ? `<br>→ Follow-up: ${retro.followUp}` : ''}` : ''}</div>`
  }).join('')}` : ''}
</body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 300)
}
