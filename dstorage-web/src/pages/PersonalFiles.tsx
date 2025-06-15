import React, { useEffect, useState, useRef } from "react";
import {Trash2, Upload} from "lucide-react"
import toast from "react-hot-toast"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { FILEVAULT_ABI } from "../contracts/abi";
import { CONTRACT_ADDRESS } from "../contracts/address";
import { useWeb3 } from "../context/Web3Context";
import { uploadPersonalFile, downloadPersonalFile } from "../ipfs/ipfsServices";


declare let window: any;

interface FileMeta {
  fileId: string;
  fileName: string;
  cid: string;
}

export default function PersonalFiles() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<FileMeta[]>([]);
  const { web3, userAddress, ipfsClient } = useWeb3();
  const [passphrase, setPassphrase] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // fetch files on load or change to web3 or userAddress
  useEffect(() => {
    if (web3 && userAddress) {
      fetchMyFiles();
    }
  }, [web3, userAddress]);

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

  // fetch personal file IDs and metadata
  const fetchMyFiles = async () => {
    if (!web3 || !userAddress) return;
    const contract = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);
    try {
      // get raw ids (could be array or object)
      const rawIds: any = await contract.methods
        .getPersonalFileIds()
        .call({ from: userAddress });
      const ids: string[] = Array.isArray(rawIds)
        ? rawIds
        : Object.values(rawIds).map((v: any) => v.toString());
      const files: FileMeta[] = await Promise.all(
        ids.map(async (id: string) => {
          const res: any = await contract.methods
            .getPersonalFile(id)
            .call({ from: userAddress });
          // getPersonalFile returns [fileName, cid]
          const fileName = res.fileName ?? res[0];
          const cid = res.cid ?? res[1];
          return { fileId: id, fileName, cid };
        })
      );
      setUploadedFiles(files);
    } catch (e) {
      console.error("Fetch error:", e);
    }
  };

  const handleUpload = async () => {
    if (!web3 || !userAddress || !ipfsClient || !selectedFile) return;

    const toastId = toast.loading("Uploading file...")

    // ask for a passphrase if not already set
    let pass = passphrase;
    if (!pass) {
      pass = window.prompt("Enter encryption passphrase:") || "";
      setPassphrase(pass);
    }
    if (!pass) return alert("Encryption passphrase required");

    try {
      const buffer = new Uint8Array(await selectedFile.arrayBuffer());
      const { cid } = await uploadPersonalFile(
        web3,
        ipfsClient,
        userAddress,
        buffer,
        selectedFile.name,
        pass
      );
      console.log("Uploaded:", cid);
      toast.success("Upload complete!")
      toast.dismiss(toastId)
      setSelectedFile(null);
      setDialogOpen(false)
      await fetchMyFiles();
    } catch (e: any) {
      toast.error("Upload failed")
      toast.dismiss(toastId)
      console.error("Upload failed", e);
      alert("Upload failed: " + (e as Error).message);
      setSelectedFile(null);
    }
  };

  // 3️⃣ Handle download
  const handleDownload = async (file: FileMeta) => {
    if (!ipfsClient) return;
    const pass = window.prompt(`Passphrase for "${file.fileName}":`) || "";
    if (!pass) return;

    try {
      toast("Download started for CID: " + file.cid)
      const data = await downloadPersonalFile(file.cid, pass);
      // trigger browser download
      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed", e);
      alert("Decryption/download failed: " + (e as Error).message);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!web3 || !userAddress) {
      toast.error("Wallet not connected");
      return;
    }

    const toastId = toast.loading("Deleting file...");
    const contract = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);
    try {
      // call the solidity deletePersonalFile(uint256)
      await contract.methods
        .deletePersonalFile(fileId)
        .send({ from: userAddress });

      toast.success("File deleted");
      toast.dismiss(toastId);

      // remove it locally
      setUploadedFiles((files) =>
        files.filter((f) => f.fileId !== fileId)
      );
    } catch (err: any) {
      console.error("Delete failed", err);
      toast.error("Delete failed: " + err.message);
    }
  };

  return (
     <div className="px-6 py-4 w-full max-w-7xl mx-auto">
      <div className="w-full flex items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-white">Personal Files</h1>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
          <thead className=" text-white">
            <tr>
              <th className="text-xl p-3 font-semibold border-b border-white text-left">Name</th>
              <th className="text-xl p-3 font-semibold border-b border-white text-left">CID</th>
              <th className="text-xl p-3 font-semibold border-b border-white text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {uploadedFiles.map((file) => (
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
                <td className="text-xl p-3 text-right space-x-2 align-middle">
                  <button onClick={() => handleDelete(file.fileId)} className="text-red-500 hover:text-red-700">
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
