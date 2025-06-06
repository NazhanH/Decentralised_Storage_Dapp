// src/pages/Groups.tsx
import { FormEvent, useEffect, useState } from 'react'
import { FILEVAULT_ABI } from '../contracts/abi'
import { CONTRACT_ADDRESS } from '../contracts/address'
import { useWeb3 } from '../context/Web3Context'
import { wrapKeyFor } from '../crypto'
import { NavLink } from 'react-router-dom'

declare let window: any

interface GroupMeta {
  folderName: string
  folderId: number
}

export default function Groups() {
  const { web3, userAddress } = useWeb3()
  const [groups, setGroups] = useState<GroupMeta[]>([])
  const [newName, setNewName] = useState<string>('')
  const [membersInput, setMembersInput] = useState<string>(userAddress || '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    if (web3 && userAddress) loadGroups()
  }, [web3, userAddress])

  async function loadGroups() {
    const contract = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS)
    const raw: any = await contract.methods
      .getGroupFolders()
      .call({ from: userAddress })

    const idsRaw = raw.folderIds ?? raw[0]
    const namesRaw = raw.folderNames ?? raw[1]
    const ids: string[] = Array.isArray(idsRaw)
      ? idsRaw
      : Object.values(idsRaw).map((v: any) => v.toString())
    const names: string[] = Array.isArray(namesRaw)
      ? namesRaw
      : Object.values(namesRaw).map((v: any) => v.toString())

    const list = ids.map((id, idx) => ({
      folderId: Number(id),
      folderName: names[idx]
    }))
    setGroups(list)
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!web3 || !userAddress || !newName || !membersInput) return

    const members = membersInput.split(',').map(a => a.trim()).filter(a => a)

    setLoading(true)
    try{
      const contract = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS)

      const pubKeys: string[] = await contract.methods
      .getEncryptionKeys(members)
      .call({ from: userAddress })

      for (let i = 0; i < members.length; i++) {
        if (!pubKeys[i] || pubKeys[i].length === 0) {
          throw new Error(`Member ${members[i]} has not registered a public key yet`)
        }
      }

      const keyBytes = window.crypto.getRandomValues(new Uint8Array(32))
      
      const wrappedKeys = await Promise.all(
        pubKeys.map(pk => wrapKeyFor(pk, keyBytes))
      )

      await contract.methods
        .createFolder(newName, members, wrappedKeys)
        .send({ from: userAddress })

      setNewName('')
      setMembersInput(userAddress)
      await loadGroups()
      setLoading(false)

    }catch (err: any) {
      console.error('Group creation failed', err)
      setError(err.message || 'Failed to create group')
      setLoading(false)
    }
    
  }

  return (
    <div>
      <h2>My Group Folders</h2>
      {error && (
        <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>
      )}
      <form onSubmit={onCreate} style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Group name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          style={{ marginRight: 8 }}
          required
        />
        <input
          type="text"
          placeholder="Member addresses (comma-separated)"
          value={membersInput}
          onChange={e => setMembersInput(e.target.value)}
          style={{ marginRight: 8, width: '50%' }}
          required
        />
        <button type="submit" disabled={loading}
          >{loading ? 'Creating…' : 'Create Group'}
        </button>
      </form>
      <ul>
        {groups.map(f => (
          <li key={f.folderId} style={{ marginBottom: 6 }}>
            <NavLink to={`/in/groups/${f.folderId}`}>📁 {f.folderName}</NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}