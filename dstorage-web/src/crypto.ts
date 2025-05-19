// crypto.ts
const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** Derive a CryptoKey from a string passphrase */
export async function deriveKey(
  pass: string,
  salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16))
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const passKey = await crypto.subtle.importKey(
    "raw", encoder.encode(pass), "PBKDF2", false, ["deriveKey"]
  )
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256"
    },
    passKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
  return { key, salt }
}

/** Encrypt an ArrayBuffer with AES-GCM; returns salt|iv|ciphertext */
export async function encrypt(buffer: ArrayBuffer, key: CryptoKey): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    buffer
  )
  // Concatenate IV + ciphertext into one Uint8Array
  const ct = new Uint8Array(ciphertext)
  const out = new Uint8Array(iv.byteLength + ct.byteLength)
  out.set(iv, 0)
  out.set(ct, iv.byteLength)
  return out
}

/** Decrypt combined(iv|ciphertext) ArrayBuffer */
export async function decrypt(data: Uint8Array, key: CryptoKey): Promise<ArrayBuffer> {
  const iv = data.slice(0, 12)
  const ct = data.slice(12)
  return await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ct.buffer
  )
}
