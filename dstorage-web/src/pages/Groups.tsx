// src/pages/Groups.tsx
import { FormEvent, useEffect, useState } from 'react'
import { FILEVAULT_ABI } from '../contracts/abi'
import { CONTRACT_ADDRESS } from '../contracts/address'
import { useWeb3 } from '../context/Web3Context'
import { wrapKeyFor } from '../crypto'
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import toast from "react-hot-toast"
import { useNavigate } from 'react-router-dom'
import { Plus } from "lucide-react"

declare let window: any

interface GroupMeta {
  folderName: string
  folderId: number
  folderOwner: string
}

export default function Groups() {
  const { web3, userAddress } = useWeb3()
  const [groups, setGroups] = useState<GroupMeta[]>([])
  const [newName, setNewName] = useState("")
  const [membersInput, setMembersInput] = useState("")
  const [membersList, setMembersList] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (web3 && userAddress) loadGroups()
  }, [web3, userAddress])

  useEffect(() => {
  if (userAddress) {
    setMembersList([userAddress])
    // setMembersInput(userAddress)
  }
}, [userAddress])

  async function loadGroups() {
    const contract = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS)
    const raw: any = await contract.methods
      .getGroupFolders()
      .call({ from: userAddress })

    const idsRaw = raw.folderIds ?? raw[0]
    const namesRaw = raw.folderNames ?? raw[1]
    const ownersRaw = raw.folderOwners ?? raw[2]
    const ids: string[] = Array.isArray(idsRaw)
      ? idsRaw
      : Object.values(idsRaw).map((v: any) => v.toString())
    const names: string[] = Array.isArray(namesRaw)
      ? namesRaw
      : Object.values(namesRaw).map((v: any) => v.toString())
    const owners: string[] = Array.isArray(ownersRaw)
      ? ownersRaw
      : Object.values(ownersRaw).map((v: any) => v.toString())

    const list = ids.map((id, idx) => ({
      folderId: Number(id),
      folderName: names[idx],
      folderOwner: owners[idx].toLowerCase(),
    }))

    list.sort((a, b) => a.folderId - b.folderId)
    setGroups(list)
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!web3 || !userAddress || !newName || membersList.length === 1) return

    setLoading(true)
    try{
      const contract = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS)

      const pubKeys: string[] = await contract.methods
      .getEncryptionKeys(membersList)
      .call({ from: userAddress })

      for (let i = 0; i < membersList.length; i++) {
        if (!pubKeys[i] || pubKeys[i].length === 0) {
          throw new Error(`Member ${membersList[i]} has not registered a public key yet`)
        }
      }

      const keyBytes = window.crypto.getRandomValues(new Uint8Array(32))
      
      const wrappedKeys = await Promise.all(
        pubKeys.map(pk => wrapKeyFor(pk, keyBytes))
      )

      await contract.methods
        .createFolder(newName, membersList, wrappedKeys)
        .send({ from: userAddress })

      toast.success("Group created!")
      setDialogOpen(false)
      setNewName("")
      setMembersInput("")
      setMembersList([userAddress])
      await loadGroups()
      setLoading(false)

    }catch (err: any) {
      console.error('Group creation failed', err)
      setError(err.message || 'Failed to create group')
      setLoading(false)
    }
    
  }

  return (
    <div className="px-6 py-4 w-full max-w-7xl mx-auto">
      <div className="w-full flex items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold text-white">Group Folders</h1>
        {error && (
          <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button className="p-2 rounded bg-neutral-800 hover:bg-neutral-700 text-white">
              <Plus size={20} />
            </button>
          </DialogTrigger>
          <DialogContent className="bg-neutral-900 text-white max-w-md rounded">
            <h2 className="text-lg font-semibold mb-4">Create Group</h2>
            <form
              onSubmit={onCreate}
              className="space-y-4"
            >
              <input
                type="text"
                placeholder="Group name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 rounded bg-neutral-800 text-white border border-neutral-700 focus:outline-none"
                required
              />

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter member address"
                  value={membersInput}
                  onChange={(e) => setMembersInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded bg-neutral-800 text-white border border-neutral-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (membersInput.trim()) {
                      const candidate = membersInput.trim().toLowerCase()
                      // avoid dupes
                      if (membersList.some(m => m.toLowerCase() === candidate)) {
                        toast.error("That address is already added")
                      } else {
                        setMembersList(prev => [...prev, membersInput.trim()])
                      }
                      setMembersInput("")
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded"
                >
                  <Plus size={15} />
                </button>
              </div>

              <ul className="text-sm text-gray-400">
                {membersList.map((member, idx) => (
                  <li key={idx} className="flex justify-between items-center border-b border-gray-700 py-1">
                    <span>{member}</span>
                    {member !== userAddress && (
                      <button
                        onClick={() =>
                          setMembersList(membersList.filter((m) => m !== member))
                        }
                        className="text-red-400 hover:text-red-200 text-xs"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDialogOpen(false);
                    setNewName("");
                    setMembersList([userAddress]);
                    setMembersInput("");
                  }}
                  className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white"
                >
                  {loading ? "Creating…" : "Create Group"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {groups.map((group) => (
          <div
            key={group.folderId}
            onClick={() => navigate(`/in/groups/${group.folderId}`)}
            className="group cursor-pointer w-56"
          >
            <div className="h-3 w-1/2 rounded-t-md bg-gray-800 group-hover:bg-sky-800"></div>

            <div className="rounded-b-md bg-gray-700 group-hover:bg-sky-700 p-4 shadow-md">
              <h3 className="text-xl text-white font-semibold mb-2">{group.folderName}</h3>
              <p className="text-sm text-white break-words">{group.folderOwner}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}