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
    const keyBytes = window.crypto.getRandomValues(new Uint8Array(32))

    // wrap for each member
    const pubKeys = await Promise.all(
      members.map(addr =>
        window.ethereum.request({
          method: 'eth_getEncryptionPublicKey',
          params: [addr]
        })
      )
    )
    const wrappedKeys = await Promise.all(
      pubKeys.map(pk => wrapKeyFor(pk, keyBytes))
    )

    const contract = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS)
    await contract.methods
      .createFolder(newName, members, wrappedKeys)
      .send({ from: userAddress })

    setNewName('')
    setMembersInput(userAddress)
    loadGroups()
  }

  return (
    <div>
      <h2>My Group Folders</h2>
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
        <button type="submit">Create Group</button>
      </form>
      <ul>
        {groups.map(f => (
          <li key={f.folderId} style={{ marginBottom: 6 }}>
            <NavLink to={`/groups/${f.folderId}`}>📁 {f.folderName}</NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}