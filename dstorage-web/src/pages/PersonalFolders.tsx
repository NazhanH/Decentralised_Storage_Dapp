// src/pages/PersonalFolders.tsx
import { FormEvent, useEffect, useState } from 'react'
import { FILEVAULT_ABI } from '../contracts/abi'
import { CONTRACT_ADDRESS } from '../contracts/address'
import { useWeb3 } from '../context/Web3Context'
import { wrapKeyFor } from '../crypto'
import { NavLink } from 'react-router-dom'

declare let window: any


interface FolderMeta {
    folderName: string
    folderId: number
    }


export default function PersonalFolders() {
  const { web3, userAddress } = useWeb3()
  const [folders, setFolders] = useState<FolderMeta[]>([])
  const [newName, setNewName] = useState<string>('')

  useEffect(() => {
    if (web3 && userAddress) loadPersonalFolders()
  }, [web3, userAddress])

  async function loadPersonalFolders() {
    const contract = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS)
    const raw: any = await contract.methods
      .getPersonalFolders()
      .call({ from: userAddress })

    // raw may have both numeric and named keys
    const idsRaw = raw.folderIds ?? raw[0]
    const namesRaw = raw.folderNames ?? raw[1]
    // normalize to string[]
    const ids: string[] = Array.isArray(idsRaw)
      ? idsRaw
      : Object.values(idsRaw).map((v: any) => v.toString())
    const names: string[] = Array.isArray(namesRaw)
      ? namesRaw
      : Object.values(namesRaw).map((v: any) => v.toString())

    console.log('Personal folders:', ids, names)

    const list = ids.map((id, idx) => ({
      folderId: Number(id),
      folderName: names[idx]
    }))
    setFolders(list)
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!web3 || !userAddress || !newName) return


    const keyBytes = window.crypto.getRandomValues(new Uint8Array(32))

    // wrap for yourself
    const pubKey: string = await window.ethereum.request({
      method: 'eth_getEncryptionPublicKey',
      params: [userAddress]
    })
    
    const wrappedHex =await wrapKeyFor(pubKey, keyBytes)

    //const envelopeHex = web3.utils.utf8ToHex(wrappedJson)
      
    const contract = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS)
    await contract.methods
      .createFolder(newName, [userAddress], [wrappedHex])
      .send({ from: userAddress })

    setNewName('')
    loadPersonalFolders()
  }

return (
    <div>
      <h2>My Personal Folders</h2>
      <form onSubmit={onCreate} style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Folder name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button type="submit">Create Folder</button>
      </form>
      <ul>
        {folders.map(f => (
          <li key={f.folderId} style={{ marginBottom: 6 }} className="folder-link">
            <NavLink to={`/in/folders/${f.folderId}`} >
                📁 {f.folderName}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
)
}
