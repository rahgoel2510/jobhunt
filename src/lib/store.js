import { db, runMigration } from './db'
import { encrypt, decrypt, generateSalt, toBase64, fromBase64 } from './crypto'

let _passphrase = null

export function setPassphrase(p) { _passphrase = p }
export function getPassphrase() { return _passphrase }
export function isUnlocked() { return !!_passphrase }

async function getSalt() {
  const meta = await db.meta.get('salt')
  return fromBase64(meta.value)
}

const INDEXED_FIELDS = {
  applications: ['id', 'status', 'dateApplied', 'tags', 'company'],
  resumes: ['id', 'name'],
  prepGuides: ['id', 'applicationId'],
  interviewRounds: ['id', 'applicationId', 'date'],
  retrospectives: ['id', 'roundId', 'applicationId'],
}

async function encryptRecord(table, record) {
  const salt = await getSalt()
  const indexed = INDEXED_FIELDS[table] || ['id']
  const sensitive = {}
  const result = {}
  for (const [k, v] of Object.entries(record)) {
    if (indexed.includes(k)) result[k] = v
    else sensitive[k] = v
  }
  result._encrypted = await encrypt(JSON.stringify(sensitive), _passphrase, salt)
  return result
}

async function decryptRecord(record) {
  if (!record || !record._encrypted) return record
  const salt = await getSalt()
  const decrypted = JSON.parse(await decrypt(record._encrypted, _passphrase, salt))
  const { _encrypted, ...rest } = record
  return { ...rest, ...decrypted }
}

export const store = {
  async setupPassphrase(passphrase) {
    const salt = generateSalt()
    const verifyToken = await encrypt('jobhunt-verify', passphrase, salt)
    await db.meta.put({ key: 'salt', value: toBase64(salt) })
    await db.meta.put({ key: 'verify', value: JSON.stringify(verifyToken) })
    await db.meta.put({ key: 'migrated_v2', value: 'true' })
    _passphrase = passphrase
  },

  async verifyPassphrase(passphrase) {
    const saltMeta = await db.meta.get('salt')
    if (!saltMeta) return false
    const salt = fromBase64(saltMeta.value)
    const verifyMeta = await db.meta.get('verify')
    try {
      const result = await decrypt(JSON.parse(verifyMeta.value), passphrase, salt)
      if (result === 'jobhunt-verify') {
        _passphrase = passphrase
        await runMigration(passphrase)
        return true
      }
      return false
    } catch { return false }
  },

  async isSetup() {
    return !!(await db.meta.get('salt'))
  },

  async add(table, record) {
    const encrypted = await encryptRecord(table, record)
    return db[table].add(encrypted)
  },

  async put(table, record) {
    const encrypted = await encryptRecord(table, record)
    return db[table].put(encrypted)
  },

  async get(table, id) {
    const record = await db[table].get(id)
    return decryptRecord(record)
  },

  async getAll(table) {
    const records = await db[table].toArray()
    return Promise.all(records.map(decryptRecord))
  },

  async query(table, indexName, value) {
    const records = await db[table].where(indexName).equals(value).toArray()
    return Promise.all(records.map(decryptRecord))
  },

  async delete(table, id) {
    return db[table].delete(id)
  },

  async exportAll() {
    const salt = await getSalt()
    const verify = await db.meta.get('verify')
    const data = {}
    for (const table of ['applications', 'resumes', 'prepGuides', 'interviewRounds', 'retrospectives']) {
      data[table] = await db[table].toArray()
    }
    return JSON.stringify({ salt: toBase64(salt), verify: verify.value, data })
  },

  async importAll(json) {
    const { salt, verify, data } = JSON.parse(json)
    await db.meta.put({ key: 'salt', value: salt })
    if (verify) await db.meta.put({ key: 'verify', value: verify })
    await db.meta.put({ key: 'migrated_v2', value: 'true' })
    for (const [table, records] of Object.entries(data)) {
      await db[table].clear()
      if (records.length) await db[table].bulkAdd(records)
    }
  },

  async clearAll() {
    for (const table of ['applications', 'resumes', 'prepGuides', 'interviewRounds', 'retrospectives', 'meta']) {
      await db[table].clear()
    }
    _passphrase = null
  }
}
