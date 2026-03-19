import 'server-only'

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import * as argon2 from 'argon2'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM standard: 96-bit IV
const AUTH_TAG_LENGTH = 16

function getMasterKey(): Buffer {
  const hex = process.env.ENCRYPTION_MASTER_KEY
  if (!hex) throw new Error('[crypto] ENCRYPTION_MASTER_KEY is not set')
  if (hex.length !== 64) throw new Error('[crypto] ENCRYPTION_MASTER_KEY must be 64 hex chars (32 bytes)')
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a colon-separated string: "iv_hex:authTag_hex:ciphertext_hex"
 * The authTag ensures integrity — any tampering will throw on decrypt.
 */
export function encrypt(plainText: string): string {
  const key = getMasterKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypts a string produced by encrypt().
 * Throws if the ciphertext has been tampered with (authTag mismatch).
 */
export function decrypt(encryptedText: string): string {
  const key = getMasterKey()
  const parts = encryptedText.split(':')
  if (parts.length !== 3) throw new Error('[crypto] Invalid encrypted format')

  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string]

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, 'hex'),
    { authTagLength: AUTH_TAG_LENGTH },
  )
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

/**
 * Hashes a password using argon2id (OWASP recommended settings).
 * memoryCost: 64 MiB, timeCost: 3 iterations, parallelism: 1
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 1,
  })
}

/**
 * Verifies a password against an argon2id hash.
 * Returns false (not throws) on mismatch — safe to use in login flows.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch {
    // argon2 throws on malformed hash — treat as verification failure
    return false
  }
}
