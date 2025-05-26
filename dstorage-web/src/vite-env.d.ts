/// <reference types="vite/client" />

declare module 'tweetnacl-sealedbox-js' {
  /**
   * Seals `message` under the recipient’s publicKey using XSalsa20-Poly1305.
   * Returns the sealed bytes.
   */
  export default function seal(
    message: Uint8Array,
    publicKey: Uint8Array
  ): Uint8Array;
}

// many modules have their own @types, so tweetnacl-util is probably fine,
// but if TS still complains, add this too:
declare module 'tweetnacl-util' {
  export function decodeBase64(s: string): Uint8Array;
  export function encodeBase64(b: Uint8Array): string;
  export function encodeUTF8(b: Uint8Array): string;
  export function decodeUTF8(s: string): Uint8Array;
}

declare module '@metamask/eth-sig-util/dist/browser' {
  export interface EncryptReturn {
    version: 'x25519-xsalsa20-poly1305'
    nonce:     string
    ephemPublicKey: string
    ciphertext:     string
  }
  export function encrypt(opts: {
    publicKey: string
    data:      string
    version:   'x25519-xsalsa20-poly1305'
  }): EncryptReturn
}