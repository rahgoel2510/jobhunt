import { createContext, useContext, useState, useEffect } from 'react'
import { store, setPassphrase } from '../../lib/store'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const isSetup = await store.isSetup()
        if (!isSetup) { setState('setup'); return }

        // Try restoring session
        const cached = sessionStorage.getItem('_kp')
        if (cached) {
          const ok = await store.verifyPassphrase(cached)
          if (ok) { setPassphrase(cached); setState('unlocked'); return }
          sessionStorage.removeItem('_kp')
        }
        setState('locked')
      } catch (e) {
        console.error('Auth init failed:', e)
        setState('setup')
      }
    })()
  }, [])

  async function setup(passphrase) {
    setError('')
    if (passphrase.length < 8) { setError('Minimum 8 characters'); return }
    await store.setupPassphrase(passphrase)
    sessionStorage.setItem('_kp', passphrase)
    setState('unlocked')
  }

  async function unlock(passphrase) {
    setError('')
    const ok = await store.verifyPassphrase(passphrase)
    if (!ok) { setError('Wrong passphrase'); return }
    setPassphrase(passphrase)
    sessionStorage.setItem('_kp', passphrase)
    setState('unlocked')
  }

  function lock() {
    setPassphrase(null)
    sessionStorage.removeItem('_kp')
    setState('locked')
  }

  return (
    <AuthContext.Provider value={{ state, error, setup, unlock, lock }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
