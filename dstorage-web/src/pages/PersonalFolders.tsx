// src/pages/PersonalFolders.tsx
import { FormEvent, useEffect, useState } from 'react'
import { FILEVAULT_ABI } from '../contracts/abi'
import { CONTRACT_ADDRESS } from '../contracts/address'
import { useWeb3 } from '../context/Web3Context'
import { wrapKeyFor } from '../crypto'
import { NavLink } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Plus } from "lucide-react"


declare let window: any


interface FolderMeta {
    folderName: string
    folderId: number
    }


export default function PersonalFolders() {
  const { web3, userAddress } = useWeb3()
  const [folders, setFolders] = useState<FolderMeta[]>([])
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate()

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

    setNewName("")
    setDialogOpen(false);  
    await loadPersonalFolders()
  }

return (
    <div className="px-6 py-4 w-full max-w-7xl mx-auto">

      <div className="w-full flex items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold text-white">Personal Folders</h1>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button className="p-2 rounded bg-neutral-800 hover:bg-neutral-700 text-white">
              <Plus size={20} />
            </button>
          </DialogTrigger>
          <DialogContent className="bg-neutral-900 text-white max-w-md rounded">
            <h2 className="text-lg font-semibold mb-4">New Folder</h2>
            <form
              onSubmit={onCreate}
              className="space-y-4"
            >
              <input
                type="text"
                placeholder="Folder name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 rounded bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Create
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {/* <form onSubmit={onCreate} style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Folder name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button type="submit">Create Folder</button>
      </form> */}
      {/* <ul>
        {folders.map(f => (
          <li key={f.folderId} style={{ marginBottom: 6 }} className="folder-link">
            <NavLink to={`/in/folders/${f.folderId}`} >
                📁 {f.folderName}
            </NavLink>
          </li>
        ))}
      </ul> */}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {folders.map((folder) => (
          <div
            key={folder.folderId}
            onClick={() => navigate(`/in/folders/${folder.folderId}`)}
            className="group cursor-pointer w-56"
          >
            <div className="h-3 w-1/2 rounded-t-md bg-gray-800 group-hover:bg-sky-800"></div>

            <div className="rounded-b-md bg-gray-700 group-hover:bg-sky-700 p-4 shadow-md">
              <h3 className="text-xl text-white font-semibold mb-2">{folder.folderName}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
)
}
