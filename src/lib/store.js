import { firedb } from './firebase'
import { collection, doc, getDocs, getDoc, addDoc, setDoc, deleteDoc, query, where } from 'firebase/firestore'
import { encrypt, decrypt, generateSalt, toBase64, fromBase64 } from './crypto'

let _passphrase = null

export function setPassphrase(p) { _passphrase = p }
export function getPassphrase() { return _passphrase }
export function isUnlocked() { return !!_passphrase }

const metaRef = () => collection(firedb, 'meta')
const metaDoc = (key) => doc(firedb, 'meta', key)

async function getSalt() {
  const snap = await getDoc(metaDoc('salt'))
  return fromBase64(snap.data().value)
}

const INDEXED_FIELDS = {
  applications: ['status', 'dateApplied', 'tags', 'company'],
  resumes: ['name', 'category'],
  prepGuides: ['applicationId'],
  interviewRounds: ['applicationId', 'date'],
  retrospectives: ['roundId', 'applicationId'],
}

async function encryptRecord(table, record) {
  const salt = await getSalt()
  const indexed = INDEXED_FIELDS[table] || []
  const sensitive = {}
  const result = {}
  for (const [k, v] of Object.entries(record)) {
    if (k === 'id') continue
    if (indexed.includes(k)) result[k] = v
    else sensitive[k] = v
  }
  result._encrypted = await encrypt(JSON.stringify(sensitive), _passphrase, salt)
  return result
}

async function decryptRecord(id, data) {
  if (!data || !data._encrypted) return { id, ...data }
  const salt = await getSalt()
  const decrypted = JSON.parse(await decrypt(data._encrypted, _passphrase, salt))
  const { _encrypted, ...rest } = data
  return { id, ...rest, ...decrypted }
}

export const store = {
  async setupPassphrase(passphrase) {
    const salt = generateSalt()
    const verifyToken = await encrypt('jobhunt-verify', passphrase, salt)
    await setDoc(metaDoc('salt'), { value: toBase64(salt) })
    await setDoc(metaDoc('verify'), { value: JSON.stringify(verifyToken) })
    _passphrase = passphrase
  },

  async verifyPassphrase(passphrase) {
    const saltSnap = await getDoc(metaDoc('salt'))
    if (!saltSnap.exists()) return false
    const salt = fromBase64(saltSnap.data().value)
    const verifySnap = await getDoc(metaDoc('verify'))
    try {
      const result = await decrypt(JSON.parse(verifySnap.data().value), passphrase, salt)
      if (result === 'jobhunt-verify') { _passphrase = passphrase; return true }
      return false
    } catch { return false }
  },

  async isSetup() {
    const snap = await getDoc(metaDoc('salt'))
    return snap.exists()
  },

  async add(table, record) {
    const encrypted = await encryptRecord(table, record)
    const ref = await addDoc(collection(firedb, table), encrypted)
    return ref.id
  },

  async put(table, record) {
    const { id, ...rest } = record
    const encrypted = await encryptRecord(table, rest)
    await setDoc(doc(firedb, table, String(id)), encrypted)
  },

  async get(table, id) {
    const snap = await getDoc(doc(firedb, table, String(id)))
    if (!snap.exists()) return null
    return decryptRecord(snap.id, snap.data())
  },

  async getAll(table) {
    const snap = await getDocs(collection(firedb, table))
    return Promise.all(snap.docs.map(d => decryptRecord(d.id, d.data())))
  },

  async query(table, indexName, value) {
    const q = query(collection(firedb, table), where(indexName, '==', value))
    const snap = await getDocs(q)
    return Promise.all(snap.docs.map(d => decryptRecord(d.id, d.data())))
  },

  async delete(table, id) {
    await deleteDoc(doc(firedb, table, String(id)))
  },

  async exportAll() {
    const saltSnap = await getDoc(metaDoc('salt'))
    const verifySnap = await getDoc(metaDoc('verify'))
    const data = {}
    for (const table of ['applications', 'resumes', 'prepGuides', 'interviewRounds', 'retrospectives']) {
      const snap = await getDocs(collection(firedb, table))
      data[table] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    }
    return JSON.stringify({ salt: saltSnap.data().value, verify: verifySnap.data().value, data })
  },

  async importAll(json) {
    const { salt, verify, data } = JSON.parse(json)
    await setDoc(metaDoc('salt'), { value: salt })
    if (verify) await setDoc(metaDoc('verify'), { value: verify })
    for (const [table, records] of Object.entries(data)) {
      // Clear existing
      const existing = await getDocs(collection(firedb, table))
      await Promise.all(existing.docs.map(d => deleteDoc(d.ref)))
      // Add new
      for (const r of records) {
        const { id, ...rest } = r
        await setDoc(doc(firedb, table, id || crypto.randomUUID()), rest)
      }
    }
  },

  async clearAll() {
    for (const table of ['applications', 'resumes', 'prepGuides', 'interviewRounds', 'retrospectives', 'meta']) {
      const snap = await getDocs(collection(firedb, table))
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
    }
    _passphrase = null
  }
}
