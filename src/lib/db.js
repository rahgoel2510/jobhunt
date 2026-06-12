import Dexie from 'dexie'
import { encrypt, decrypt, fromBase64 } from './crypto'
import { STATUS_MIGRATION_MAP } from './constants'

export const db = new Dexie('jobhunt')

db.version(1).stores({
  meta: 'key',
  applications: '++id, company, status, dateApplied, *tags',
  resumes: '++id, name',
  prepGuides: '++id, applicationId',
  interviewRounds: '++id, applicationId, date',
  retrospectives: '++id, roundId, applicationId',
})

// v2: same indexes, migration handles data transformation
db.version(2).stores({
  meta: 'key',
  applications: '++id, company, status, dateApplied, *tags',
  resumes: '++id, name',
  prepGuides: '++id, applicationId',
  interviewRounds: '++id, applicationId, date',
  retrospectives: '++id, roundId, applicationId',
})

/**
 * Run after passphrase is verified. Checks if data needs migration from v1 format.
 * Decrypts each application, transforms status, adds statusHistory, re-encrypts.
 */
export async function runMigration(passphrase) {
  const migrated = await db.meta.get('migrated_v2')
  if (migrated) return

  const saltMeta = await db.meta.get('salt')
  if (!saltMeta) { await db.meta.put({ key: 'migrated_v2', value: 'true' }); return }
  const salt = fromBase64(saltMeta.value)

  const apps = await db.applications.toArray()
  for (const app of apps) {
    let sensitive = {}
    if (app._encrypted) {
      try { sensitive = JSON.parse(await decrypt(app._encrypted, passphrase, salt)) }
      catch { continue }
    }

    // Map old status to new enum
    const oldStatus = app.status || sensitive.status || 'applied'
    const newStatus = STATUS_MIGRATION_MAP[oldStatus.toLowerCase()] || STATUS_MIGRATION_MAP[oldStatus] || 'Applied'

    // Build statusHistory if missing
    if (!sensitive.statusHistory) {
      const timestamp = sensitive.dateApplied || app.dateApplied || new Date().toISOString()
      sensitive.statusHistory = [{ fromStatus: null, toStatus: newStatus, timestamp, note: 'Initial status' }]
    }

    // Map old source values
    if (sensitive.source) {
      const sourceMap = { 'referral': 'Referral', 'job board': 'Cold Application', 'cold outreach': 'Cold Application', 'recruiter': 'Recruiter Outreach', 'company site': 'Cold Application', 'other': 'Cold Application' }
      sensitive.source = sourceMap[sensitive.source.toLowerCase()] || sensitive.source
    }

    // Re-encrypt
    const indexed = ['id', 'status', 'dateApplied', 'tags', 'company']
    const result = {}
    const toEncrypt = { ...sensitive }
    for (const k of indexed) { if (app[k] !== undefined) result[k] = app[k] }
    result.status = newStatus
    result._encrypted = await encrypt(JSON.stringify(toEncrypt), passphrase, salt)
    result.id = app.id

    await db.applications.put(result)
  }

  await db.meta.put({ key: 'migrated_v2', value: 'true' })
}
