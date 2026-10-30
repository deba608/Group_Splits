import type { Expense, Payment } from './splits'
import type { Trip } from './storage'

export interface TripLock {
  v: 1
  /** PBKDF2 salt, base64. */
  salt: string
  /** AES-GCM nonce, base64. Rotates on every save. */
  iv: string
  /** AES-GCM ciphertext of the trip payload, base64. */
  data: string
}

interface Payload {
  name: string
  currency?: string
  members: string[]
  expenses: Expense[]
  payments?: Payment[]
  createdAt?: string
}

const ITERATIONS = 210_000
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passcode),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function payloadOf(trip: Trip): Payload {
  return {
    name: trip.name,
    currency: trip.currency,
    members: trip.members,
    expenses: trip.expenses,
    payments: trip.payments,
    createdAt: trip.createdAt,
  }
}

function lockedShell(trip: Trip, lock: TripLock): Trip {
  return {
    id: trip.id,
    name: 'Locked trip',
    currency: trip.currency,
    members: [],
    expenses: [],
    createdAt: trip.createdAt,
    lock,
  }
}

/**
 * Encrypt the trip with an existing key. Reuses the lock salt, rotates the IV.
 * The returned trip has no readable content until it is unlocked again.
 */
export async function sealTrip(
  trip: Trip,
  key: CryptoKey,
  salt: string
): Promise<Trip> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encoder.encode(JSON.stringify(payloadOf(trip)))
  )
  return lockedShell(trip, {
    v: 1,
    salt,
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
  })
}

/** First lock: creates a salt, derives a key from the passcode, seals the trip. */
export async function lockTrip(
  trip: Trip,
  passcode: string
): Promise<{ trip: Trip; key: CryptoKey; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltB64 = toBase64(salt)
  const key = await deriveKey(passcode, salt)
  return { trip: await sealTrip(trip, key, saltB64), key, salt: saltB64 }
}

/** Re-derive the key from the stored salt and decrypt. Throws on a wrong passcode. */
export async function openTrip(
  trip: Trip,
  passcode: string
): Promise<{ trip: Trip; key: CryptoKey }> {
  if (!trip.lock) throw new Error('Trip is not locked.')
  const salt = fromBase64(trip.lock.salt)
  const key = await deriveKey(passcode, salt)
  let plain: string
  try {
    const buffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(trip.lock.iv) as BufferSource },
      key,
      fromBase64(trip.lock.data) as BufferSource
    )
    plain = decoder.decode(buffer)
  } catch {
    throw new Error('Wrong passcode.')
  }
  const payload = JSON.parse(plain) as Payload
  return {
    trip: {
      id: trip.id,
      name: payload.name,
      currency: payload.currency ?? trip.currency ?? 'INR',
      members: payload.members,
      expenses: payload.expenses,
      payments: payload.payments,
      createdAt: payload.createdAt ?? trip.createdAt,
      lock: trip.lock,
    },
    key,
  }
}

/** Drop the lock metadata, leaving the (already decrypted) trip readable. */
export function removeLock(trip: Trip): Trip {
  const rest: Trip = { ...trip }
  delete rest.lock
  return rest
}
