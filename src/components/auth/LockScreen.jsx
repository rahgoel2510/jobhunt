import { useState } from 'react'
import { useAuth } from './AuthContext'

export default function LockScreen() {
  const { state, error, setup, unlock } = useAuth()
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')

  if (state === 'loading') return (
    <div className="lock-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-[3px] border-border" />
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-accent animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Connecting vault...</p>
          <p className="text-[10px] text-muted mt-1">Securely loading your encrypted data</p>
        </div>
      </div>
    </div>
  )

  const isSetup = state === 'setup'

  function handleSubmit(e) {
    e.preventDefault()
    if (isSetup) {
      if (pass !== confirm) return
      setup(pass)
    } else {
      unlock(pass)
    }
  }

  return (
    <div className="lock-screen">
      <div className="card w-full max-w-sm p-6 shadow-lg border-0">
        <h1 className="text-xl font-bold tracking-tight mb-1">🔒 Job Tracker</h1>
        <p className="text-muted text-xs mb-4">
          {isSetup
            ? 'Set a passphrase to encrypt your data. There is NO recovery — if you forget it, your data is gone.'
            : 'Enter your passphrase to decrypt your data.'}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="passphrase">Passphrase</label>
            <input id="passphrase" type="password" value={pass} onChange={e => setPass(e.target.value)} autoFocus autoComplete="off" />
          </div>
          {isSetup && <div>
            <label htmlFor="confirm">Confirm Passphrase</label>
            <input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="off" />
            {pass && confirm && pass !== confirm && <p className="text-danger text-[11px] mt-1">Passphrases don't match</p>}
          </div>}
          {error && <p className="text-danger text-[11px]">{error}</p>}
          <button type="submit" className="primary w-full mt-1">{isSetup ? 'Create Vault' : 'Unlock'}</button>
        </form>
        {isSetup && <div className="mt-4 bg-bg-secondary rounded-md p-3 text-[11px] text-muted">
          ⚠️ <strong className="text-text-primary">No recovery possible.</strong> Your passphrase is the encryption key. Write it down somewhere safe.
        </div>}
      </div>
    </div>
  )
}
