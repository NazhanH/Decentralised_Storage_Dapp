// src/services/ipfsServices.ts
import type Web3 from "web3";
import type { IPFSHTTPClient } from "ipfs-http-client";
import { FILEVAULT_ABI } from "../contracts/abi";
import { CONTRACT_ADDRESS } from "../contracts/address";
import { deriveKey, encrypt, decrypt, unwrapKeyFor } from "../crypto";
import { getGatewayUrl } from "./ipfsClients";


/**
 * Upload a personal file:
 * 1. Optionally derive a key from passphrase + salt
 * 2. AES-GCM encrypt (salt || iv || ciphertext)
 * 3. store on IPFS, save CID on-chain via uploadPersonalFile()
 */
export async function uploadPersonalFile(
  web3: Web3,
  ipfsClient: IPFSHTTPClient,
  userAddress: string,
  payload: Uint8Array,
  fileName: string,
  passphrase: string
): Promise<{ cid: string }> {
  // derive AES key
  const { key, salt } = await deriveKey(passphrase);
  // encrypt payload
  const encrypted = await encrypt(payload.buffer, key);
  // prepend salt
  const packaged = new Uint8Array(salt.byteLength + encrypted.byteLength);
  packaged.set(salt, 0);
  packaged.set(encrypted, salt.byteLength);

  // upload to IPFS
  const { cid } = await ipfsClient.add(packaged);

  // record on-chain
  const ctr = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);
  await ctr.methods
    .uploadPersonalFile(fileName, cid.toString())
    .send({ from: userAddress });

  return { cid: cid.toString() };
}

/**
 * Download & decrypt a personal file:
 * 1. Fetch raw package from IPFS
 * 2. Split salt + encrypted payload
 * 3. Re-derive key and AES-GCM decrypt
 */
export async function downloadPersonalFile( cid: string, passphrase: string): Promise<Uint8Array> {

  // fetch encrypted file from IPFS
  const res = await fetch(getGatewayUrl(cid))
  const data = new Uint8Array(await res.arrayBuffer())

  // split salt (16) + ciphertext (iv||ct)
  const salt = data.slice(0, 16);
  const encrypted = data.slice(16);

  // re-derive and decrypt
  const { key } = await deriveKey(passphrase, salt);
  const plain = await decrypt(encrypted, key);
  return new Uint8Array(plain);
}

/**
 * Upload a file into a folder:
 * 1. Unwrap AES key via MetaMask eth_decrypt
 * 2. AES-GCM encrypt payload
 * 3. IPFS add, then call uploadFile(folderId, fileName, cid)
 */
export async function uploadFolderFile(web3: Web3, ipfsClient: IPFSHTTPClient, userAddress: string, folderId: number, payload: Uint8Array, fileName: string): Promise<{ cid: string }> {
  const ctr = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);

  // 1) fetch & decrypt folder key
  const wrappedHex: string = await ctr.methods
    .getEncryptedFolderKey(folderId)
    .call({ from: userAddress });
  const aesKey = await unwrapKeyFor(wrappedHex, userAddress)

  // 2) encrypt payload
  const encrypted = await encrypt(payload.buffer, aesKey);

  // 3) upload to IPFS
  const { cid } = await ipfsClient.add(encrypted);

  // 4) record on-chain
  await ctr.methods
    .uploadFile(folderId, fileName, cid.toString())
    .send({ from: userAddress });

  return {cid: cid.toString()};
}

/**
 * Download & decrypt a file from a folder:
 * 1. Fetch wrapped folder key + decrypt via MetaMask
 * 2. Fetch encrypted payload from IPFS
 * 3. AES-GCM decrypt (iv||ct) with the unwrapped key
 */
export async function downloadFolderFile(
  web3: Web3,
  userAddress: string,
  folderId: number,
  cid: string
): Promise<Uint8Array> {
  const ctr = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);

  // unwrap folder key
  const wrappedHex: string = await ctr.methods
    .getEncryptedFolderKey(folderId)
    .call({ from: userAddress });
  //const wrappedJson = web3.utils.hexToUtf8(wrappedHex);
  const aesKey = await unwrapKeyFor(wrappedHex, userAddress);

  // fetch encrypted payload
  // fetch encrypted file from IPFS
  const res = await fetch(getGatewayUrl(cid))
  const encrypted = new Uint8Array(await res.arrayBuffer())

  // decrypt (assumes iv is first 12 bytes)
  const iv = encrypted.slice(0, 12);
  const ct = encrypted.slice(12);


  const buf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ct
  );
  return new Uint8Array(buf);
}
