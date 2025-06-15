// src/pages/GroupMembers.tsx
import { useEffect, useState, ChangeEvent, FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useWeb3 } from '../context/Web3Context'
import { FILEVAULT_ABI } from '../contracts/abi'
import { CONTRACT_ADDRESS } from '../contracts/address'
import { wrapKeyFor} from '../crypto'

// Permission bit‐flags (must match those in your Solidity contract)
const PERM_MANAGE_PERMISSIONS = 1 << 0  // 0b00001
const PERM_UPLOAD             = 1 << 1  // 0b00010
const PERM_DELETE             = 1 << 2  // 0b00100



interface MemberInfo {
  address: string
  perms: number
  isOwner: boolean
}

export default function GroupMembers() {
  const { id } = useParams<{ id: string }>()
  const folderId = Number(id)
  const { web3, userAddress } = useWeb3()
  const [members, setMembers] = useState<MemberInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<Record<string, boolean>>({})

  const [newAddr, setNewAddr] = useState<string>('')
  const [adding, setAdding] = useState<boolean>(false)

  /** Fetch folder owner and full member list + permissions */
  useEffect(() => {
    if (!web3 || !userAddress || isNaN(folderId)) return
    loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [web3, userAddress, folderId])

  async function loadMembers() {
    try {
      setLoading(true)
      setError(null)

      const contract = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS)

      // 1) Fetch folder owner from on-chain (assumes your contract has a getter)
      const owner: string = await contract.methods
        .getFolderOwner(folderId) // direct public struct accessor
        .call({ from: userAddress })
 

      // 2) Fetch list of all member addresses
      const rawMembers: string[] = await contract.methods
        .getFolderMembers(folderId)
        .call({ from: userAddress })

      // 3) For each member, fetch their permission bitmask
      const infos: MemberInfo[] = await Promise.all(
        rawMembers.map(async (addr) => {
          // getMemberPermissions requires caller to be owner or a manager
          const perms: string = await contract.methods
            .getMemberPermissions(folderId, addr)
            .call({ from: userAddress })

          return {
            address: addr,
            perms: Number(perms),
            isOwner: addr.toLowerCase() === owner.toLowerCase(),
          }
        })
      )

      setMembers(infos)
      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load group members', err)
      setError('Could not fetch members or permissions.')
      setLoading(false)
    }
  }

  /** Toggle a single permission bit for a given member */
  async function togglePermission(memberAddr: string, flag: number, checked: boolean) {
    if (!web3 || !userAddress) return

    // Prevent multiple updates for same member simultaneously
    setUpdating((u) => ({ ...u, [memberAddr]: true }))
    setError(null)

    try {
      const contract = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS)

      // 1) Find the current bitmask for this member
      const current = members.find((m) => m.address === memberAddr)?.perms ?? 0

      // 2) Compute new bitmask
      const newMask = checked ? (current | flag) : (current & ~flag)

      // 3) Send transaction: setMemberPermissions(folderId, memberAddr, newMask)
      await contract.methods
        .setMemberPermissions(folderId, memberAddr, newMask)
        .send({ from: userAddress })

      // 4) Reflect the change locally
      setMembers((ms) =>
        ms.map((m) =>
          m.address === memberAddr ? { ...m, perms: newMask } : m
        )
      )

      loadMembers() // Reload to ensure consistency
    } catch (err: any) {
      console.error('Failed to update permissions', err)
      setError(err.message || 'Permission update failed.')
    } finally {
      setUpdating((u) => ({ ...u, [memberAddr]: false }))
    }
  }

  /** Handler to remove a member (only if you have PERM_REMOVE_MEMBER) */
  async function handleRemove(memberAddr: string) {
    if (!web3 || !userAddress) return

    setUpdating((u) => ({ ...u, [memberAddr]: true }))
    setError(null)

    try {
      const contract = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS)
      // Call removeMember(folderId, memberAddr)
      await contract.methods
        .removeMember(folderId, memberAddr)
        .send({ from: userAddress })

      // Reload the list after removal
      await loadMembers()
    } catch (err: any) {
      console.error('Failed to remove member', err)
      setError(err.message || 'Member removal failed.')
    } finally {
      setUpdating((u) => ({ ...u, [memberAddr]: false }))
    }
  }

  async function handleAdd(e: FormEvent) {
  e.preventDefault()
  setError(null)
  if (!web3 || !userAddress) return
  if (!newAddr.trim()) {
    setError('Please enter a valid address.')
    return
  }
  if (members.some(m => m.address.toLowerCase() === newAddr.toLowerCase())) {
    setError('That address is already a member.')
    return
  }

  setAdding(true)
  try {
    const contract = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS)

    // 1) Fetch the wrapped key for the current user
    const wrappedHex: string = await contract.methods
      .getEncryptedFolderKey(folderId)
      .call({ from: userAddress })

    // 2) Call MetaMask to decrypt; it returns a base64‐encoded string
    const b64Key: string = await (window as any).ethereum.request({
      method: 'eth_decrypt',
      params: [wrappedHex, userAddress],
    })
    // ‣ b64Key is exactly the raw AES key, base64‐encoded

    // 3) Convert base64 to Uint8Array ‣ these are your raw AES bytes
    const rawBytes = Uint8Array.from(atob(b64Key), c => c.charCodeAt(0))

    // 4) Fetch the new member’s registered public key on‐chain
    const pk: string = await contract.methods
      .encryptionKeys(newAddr)
      .call({ from: userAddress })
    if (!pk || pk.length === 0) {
      throw new Error(`User ${newAddr} has not registered.`)
    }

    // 5) Wrap rawBytes for the new member
    const wrappedForNew = await wrapKeyFor(pk, rawBytes)

    // 6) Add them on‐chain
    await contract.methods
      .addMember(folderId, newAddr, wrappedForNew)
      .send({ from: userAddress })

    // 7) Reload
    setNewAddr('')
    await loadMembers()
  } catch (err: any) {
    console.error('Failed to add member', err)
    setError(err.message || 'Add member failed.')
  } finally {
    setAdding(false)
  }
}


  /** Render a checkbox for a specific permission flag */
  function renderCheckbox(
    member: MemberInfo,
    label: string,
    flag: number,
    disabledOverride = false
  ) {
    const hasFlag = (member.perms & flag) !== 0
    const disabled = member.isOwner || disabledOverride//updating[member.address] || loading

    return (
      <label className="flex items-center gap-1 text-white">
        <input
          type="checkbox"
          checked={hasFlag}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            togglePermission(member.address, flag, e.target.checked)
          }
          className="accent-blue-500 w-4 h-4"
        />
        <span className="text-xs">{label}</span>
      </label>
    )
  }

  if (loading) {
    return <p style={{ textAlign: 'center', marginTop: '2rem' }}>Loading members…</p>
  }

  if (error) {
    return <p style={{ color: 'red', textAlign: 'center', marginTop: '1rem' }}>{error}</p>
  }

  if (members.length === 0) {
    return <p style={{ textAlign: 'center', marginTop: '2rem' }}>No members found.</p>
  }

  const myInfo = members.find(
    (m) => m.address.toLowerCase() === userAddress.toLowerCase()
  )
  const iCanManage = !!myInfo && (myInfo.perms & PERM_MANAGE_PERMISSIONS) !== 0

  return (
    <div className="px-6 py-4 w-full max-w-7xl mx-auto">
      <h2 className='text-3xl font-bold text-white'>
        Folder Members & Permissions
      </h2>

      {/* Always show members list, even if you’re not a manager */}
      {/* Add Member Form (only if I have MANAGE permission) */}
      {iCanManage && (
        <form
          onSubmit={handleAdd}
          style={{
            marginBottom: '1rem',
            display: 'flex',
            gap: '0.5rem',
          }}
        >
          <input 
            className="bg-gray-200 appearance-none border-2 border-gray-200 rounded w-full py-2 px-4 text-gray-700 leading-tight focus:outline-none focus:bg-white focus:border-sky-500"
            type="text"
            placeholder="New member address"
            value={newAddr}
            onChange={(e) => setNewAddr(e.target.value)}
            style={{ flex: 1 }}
            required
          />
          <button className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded flex items-center gap-2" type="submit" disabled={adding}>
            {adding ? 'Adding…' : 'Add Member'}
          </button>
        </form>
      )}

      <div className="space-y-4">
        {members.map((member) => {
          // if they’re not a manager, we’ll still render checkboxes but keep them disabled
          const disabledAll = !iCanManage

          return (
            <div
              key={member.address}
              className="bg-neutral-900 text-white p-4 rounded-lg shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div>
                <code className="font-mono">{member.address}</code>
                {member.isOwner && (
                  <span className="ml-2 text-green-400">(Owner)</span>
                )}
              </div>

              <div className="flex flex-wrap gap-4 items-center">
                {/* renderCheckbox already disables the input if `disabled` is true */}
                {renderCheckbox(
                  member,
                  "Upload",
                  PERM_UPLOAD,
                  /* pass down whether toggling is allowed */
                  disabledAll
                )}
                {renderCheckbox(member, "Delete", PERM_DELETE, disabledAll)}
                {renderCheckbox(member, "Manage", PERM_MANAGE_PERMISSIONS, disabledAll)}

                {/* Only show “Remove” to people who can manage (and only on non-owners) */}
                {iCanManage && !member.isOwner ? (
                  <button
                    onClick={() => handleRemove(member.address)}
                    disabled={updating[member.address]}
                    className="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded"
                  >
                    {updating[member.address] ? "Removing…" : "Remove"}
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
