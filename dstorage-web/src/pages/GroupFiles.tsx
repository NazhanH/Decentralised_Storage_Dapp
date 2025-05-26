// src/pages/GroupFiles.tsx
import { useEffect, useState, FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useWeb3 } from '../context/Web3Context'
import { FILEVAULT_ABI } from '../contracts/abi'
import { CONTRACT_ADDRESS } from '../contracts/address'
import { uploadFolderFile, downloadFolderFile } from '../ipfs/ipfsServices'

interface FileMeta {
  fileId: number
  fileName: string
  cid: string
  uploader: string
}

export default function GroupFiles() {
  const { id } = useParams<{ id: string }>()
  const folderId = Number(id)
  const { web3, userAddress, ipfsClient } = useWeb3()
  const [files, setFiles] = useState<FileMeta[]>([])
  const [folderName, setFolderName] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    if (web3 && userAddress) loadGroupFiles()
  }, [web3, userAddress, id])

  async function loadGroupFiles() {
    const ctr = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS)
    const name: string = await ctr.methods
      .getFolderName(folderId)
      .call({ from: userAddress })
    setFolderName(name)

    const rawIds: any = await ctr.methods
      .getFolderFiles(folderId)
      .call({ from: userAddress })
    const ids: number[] = (Array.isArray(rawIds)
      ? rawIds
      : Object.values(rawIds)
    ).map((v: any) => Number(v))

    const metas = await Promise.all(
      ids.map(async (fid) => {
        const fileData: { uploader: string; fileName: string; cid: string } =
          await ctr.methods
            .getFolderFile(folderId, fid)
            .call({ from: userAddress })
        const { uploader, fileName, cid } = fileData
        return { fileId: fid, uploader, fileName, cid }
      })
    )
    setFiles(metas)
  }

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault()
    if (!web3 || !userAddress || !ipfsClient || !selectedFile) return
    try {
      const buffer = new Uint8Array(await selectedFile.arrayBuffer())
      const { cid } = await uploadFolderFile(
        web3,
        ipfsClient,
        userAddress,
        folderId,
        buffer,
        selectedFile.name
      )
      console.log('Uploaded to IPFS CID:', cid)
      setSelectedFile(null)
      loadGroupFiles()
    } catch (err: any) {
      console.error('Upload failed', err)
      alert('Upload failed: ' + err.message)
    }
  }

  const handleDownload = async (file: FileMeta) => {
    if (!web3 || !userAddress || !ipfsClient) return
    try {
      const data = await downloadFolderFile(
        web3,
        userAddress,
        folderId,
        file.cid
      )
      const blob = new Blob([data])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Download failed', err)
      alert('Download failed: ' + err.message)
    }
  }

  if (!id) return <p>Invalid group folder</p>
  return (
    <div>
      <h2>{folderName}</h2>
      <form onSubmit={handleUpload} style={{ marginBottom: 16 }}>
        <input
          type="file"
          onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={!selectedFile}>
          Upload File
        </button>
      </form>
      <ul>
        {files.map(f => (
          <li key={f.fileId} style={{ marginBottom: 8 }}>
            {f.fileName} Uploader: {f.uploader}
            <button
              style={{ marginLeft: 12 }}
              onClick={() => handleDownload(f)}
            >
              Download & Decrypt
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
