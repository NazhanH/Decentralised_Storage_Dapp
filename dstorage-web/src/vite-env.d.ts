/// <reference types="vite/client" />

declare module "@metamask/eth-sig-util/dist/browser" {
  export interface EncryptReturn {
    version: "x25519-xsalsa20-poly1305";
    nonce: string;
    ephemPublicKey: string;
    ciphertext: string;
  }
  export function encrypt(opts: {
    publicKey: string;
    data: string;
    version: "x25519-xsalsa20-poly1305";
  }): EncryptReturn;
}
