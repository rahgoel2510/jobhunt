import { useState } from 'react'
import { store } from '../../lib/store'

export default function ExportImport() {
  const [status, setStatus] = useState('')

  async function handleExport() {
    setStatus('Exporting...')
    const data = await store.exportAll()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `jobhunt-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url)
    setStatus('Export complete! File downloaded.')
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setStatus('Importing...')
    try {
      await store.importAll(await file.text())
      setStatus('Import complete! Data restored. Reload to verify.')
    } catch (err) { setStatus(`Import failed: ${err.message}`) }
  }

  return (
    <div className="max-w-md space-y-3">
      <h2 className="text-sm font-semibold">Backup & Restore</h2>
      <div className="card p-3 space-y-2">
        <h3 className="text-xs font-semibold">Export (Encrypted Backup)</h3>
        <p className="text-[11px] text-muted">Downloads all data as an encrypted JSON. Remains encrypted with your passphrase.</p>
        <button className="primary" onClick={handleExport}>Export Backup</button>
      </div>
      <div className="card p-3 space-y-2">
        <h3 className="text-xs font-semibold">Import (Restore Backup)</h3>
        <p className="text-[11px] text-muted">Restore from a backup file. This <strong>replaces</strong> all current data.</p>
        <input type="file" accept=".json" onChange={handleImport} />
      </div>
      {status && <p className="text-xs bg-bg-secondary rounded-md p-2">{status}</p>}
      <div className="bg-bg-secondary rounded-md p-3 text-[11px] text-muted">
        💡 <strong className="text-text-primary">Tip:</strong> Store backups in a private gist or encrypted cloud storage.
      </div>
    </div>
  )
}
