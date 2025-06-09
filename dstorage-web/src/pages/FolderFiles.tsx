// src/pages/FolderFiles.tsx
import { useEffect, useState, FormEvent, useRef} from 'react'
import { useParams } from 'react-router-dom'
import { useWeb3 }    from '../context/Web3Context'
import { FILEVAULT_ABI } from '../contracts/abi'
import { CONTRACT_ADDRESS } from '../contracts/address'
import {uploadFolderFile, downloadFolderFile} from '../ipfs/ipfsServices'
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Download, Trash2, Folder, FileText, Upload } from "lucide-react"
import toast from "react-hot-toast"

interface FileMeta {
  fileId: number
  fileName: string
  cid: string
  uploader: string
}

export default function FolderFiles() {
  const { id } = useParams<{ id: string }>()
  const folderId = Number(id)
  const { web3, userAddress, ipfsClient } = useWeb3()
  const [files, setFiles] = useState<FileMeta[]>([])
  const [folderName, setFolderName] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!web3 || !userAddress) return
    loadFolder()
  }, [web3, userAddress, id])


async function loadFolder() {
  const ctr = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS)

      // 1) fetch folder name
    const name: string = await ctr.methods
      .getFolderName(folderId)
      .call({ from: userAddress })
    setFolderName(name)

  // 1️⃣ get the list of file IDs
  const rawIds: any = await ctr.methods
    .getFolderFiles(folderId)
    .call({ from: userAddress })
  const ids: number[] = (Array.isArray(rawIds)
    ? rawIds
    : Object.values(rawIds)
  ).map((v: any) => Number(v))

  // 2️⃣ for *each* ID, call getFolderFile to fetch metadata
  const metas = await Promise.all(
    ids.map(async (fid) => {
      const fileData: { uploader: string, fileName: string, cid: string } =
        await ctr.methods
          .getFolderFile(folderId, fid)     // ← use your new getter
          .call({ from: userAddress })
      
      const { uploader, fileName, cid } = fileData
      return { fileId: fid, uploader, fileName, cid }
    })
  )

  setFiles(metas)
}

 // ✏️ Upload handler
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
      await loadFolder()
    } catch (err: any) {
      console.error('Upload failed', err)
      alert('Upload failed: ' + err.message)
    }
  }

  // 📥 Download handler
  const handleDownload = async (file: FileMeta) => {
    if (!web3 || !userAddress || !ipfsClient) return

    try {
      const data = await downloadFolderFile(
        web3,
        userAddress,
        folderId,
        file.cid
      )
      // trigger browser download
      const blob = new Blob([data])
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = file.fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Download failed', err)
      alert('Download failed: ' + err.message)
    }
  }

    function handleDrop(e: React.DragEvent<HTMLDivElement>) {
      e.preventDefault()
      if (e.dataTransfer.files[0]) {
        setSelectedFile(e.dataTransfer.files[0])
      }
    }
    
    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
      if (e.target.files?.[0]) {
        setSelectedFile(e.target.files[0])
      }
    }
  
    // handle file change
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
    };

    function deleteFile(cid: string) {
      toast("File deleted (mock): " + cid)
    }

  if (!id) return <p>Invalid folder</p>
  return (
    <div className="px-6 py-4 w-full max-w-7xl mx-auto">
      <div className="w-full flex items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-white">{folderName}</h1>

        <Dialog>
          <DialogTrigger asChild>
            <button className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded flex items-center gap-2">
              <Upload size={18} /> Upload
            </button>
          </DialogTrigger>
          <DialogContent className="bg-neutral-800 text-white max-w-md rounded">
            <h2 className="text-lg font-semibold mb-4">Upload a File</h2>
            <div
              className="border-2 border-dashed p-6 text-center rounded cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              {selectedFile ? (
                <p className="font-semibold">{selectedFile.name}</p>
              ) : (
                <p>Click or drag file here</p>
              )}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            <button
              onClick={handleUpload}
              className="mt-4 w-full bg-green-600 text-white py-2 rounded"
            >
              Upload
            </button>
          </DialogContent>
        </Dialog>
      </div>

      {/* File Table */}
      <div className="w-full overflow-x-auto rounded-lg">
        <table className="w-full text-left border-collapse text-white bg-black">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="text-xl p-3 font-semibold border-b border-white text-left">Name</th>
              <th className="text-xl p-3 font-semibold border-b border-white text-left">CID</th>
              <th className="text-xl p-3 font-semibold border-b border-white text-left">Uploader</th>
              <th className="text-xl p-3 font-semibold border-b border-white text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.cid} className="border-b border-white hover:bg-gray-800">
                <td className="p-3 align-middle cursor-pointer hover:underline"
                  onDoubleClick={() => handleDownload(file)}>
                    <div className="flex items-center h-full">
                      <span className="text-xl text-white">{file.fileName}</span>
                    </div>
                </td>
                <td className="text-xl p-3 align-middle break-all text-sm text-gray-400">
                  {file.cid}
                </td>
                <td className="text-xl p-3 align-middle break-all text-sm text-gray-400">
                  {file.uploader}
                </td>
                <td className="text-xl p-3 text-right space-x-2 align-middle">
                  <button onClick={() => deleteFile(file.cid)}>
                    <Trash2 className="w-5 h-5 text-red-500 hover:scale-110 transition" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

  )
}
