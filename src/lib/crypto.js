const PBKDF2_ITERATIONS = 600000
const SALT_LENGTH = 16
const IV_LENGTH = 12

function toBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function fromBase64(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0))
}

async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encrypt(plaintext, passphrase, salt) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveKey(passphrase, salt)
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  )
  return { iv: toBase64(iv), data: toBase64(ciphertext) }
}

export async function decrypt(encrypted, passphrase, salt) {
  const iv = fromBase64(encrypted.iv)
  const data = fromBase64(encrypted.data)
  const key = await deriveKey(passphrase, salt)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )
  return new TextDecoder().decode(decrypted)
}

export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
}

export { toBase64, fromBase64 }
