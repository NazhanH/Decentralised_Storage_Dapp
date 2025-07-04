// src/pages/GroupFiles.tsx
import { useEffect, useState, FormEvent, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { FILEVAULT_ABI } from "../contracts/abi";
import { CONTRACT_ADDRESS } from "../contracts/address";
import {
  uploadFolderFile,
  downloadFolderFile,
  unpinFile,
} from "../ipfs/ipfsServices";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Upload, Users, DoorOpen, FolderSearch } from "lucide-react";
import toast from "react-hot-toast";

interface FileMeta {
  fileId: number;
  fileName: string;
  cid: string;
  uploader: string;
}

const PERM_UPLOAD = 1 << 1;
const PERM_DELETE = 1 << 2;

export default function GroupFiles() {
  const { id } = useParams<{ id: string }>();
  const folderId = Number(id);
  const { web3, userAddress, ipfsClient } = useWeb3();
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [folderName, setFolderName] = useState<string>("");
  const [folderOwner, setFolderOwner] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [perms, setPerms] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (web3 && userAddress) loadGroupFiles();
    loadOwner();
  }, [web3, userAddress, id]);

  useEffect(() => {
    if (!web3 || !userAddress) return;

    (async () => {
      const ctr = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);

      let members: string[];
      try {
        members = await ctr.methods
          .getFolderMembers(folderId)
          .call({ from: userAddress });
      } catch (e) {
        console.error("membership check failed", e);
        toast.error("Unable to verify access");
        navigate("/personal-folders");
        return;
      }

      const lower = members.map((a) => a.toLowerCase());
      if (!lower.includes(userAddress.toLowerCase())) {
        toast.error("Forbidden");
        navigate("/in/groups");
        return;
      }

      setIsMember(true);
      loadGroupFiles();
    })();
  }, [web3, userAddress, folderId]);

  useEffect(() => {
    if (!web3 || !userAddress) return;
    const ctr = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);

    (async () => {
      try {
        const p: string = await ctr.methods
          .myPermissions(folderId)
          .call({ from: userAddress });
        setPerms(Number(p));
      } catch (e) {
        console.error(e);
      }
    })();
  }, [web3, userAddress, folderId]);

  async function loadGroupFiles() {
    const ctr = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);
    const name: string = await ctr.methods
      .getFolderName(folderId)
      .call({ from: userAddress });
    setFolderName(name);

    const rawIds: any = await ctr.methods
      .getFolderFiles(folderId)
      .call({ from: userAddress });
    const ids: number[] = (
      Array.isArray(rawIds) ? rawIds : Object.values(rawIds)
    ).map((v: any) => Number(v));

    const metas = await Promise.all(
      ids.map(async (fid) => {
        const fileData: { uploader: string; fileName: string; cid: string } =
          await ctr.methods
            .getFolderFile(folderId, fid)
            .call({ from: userAddress });
        const { uploader, fileName, cid } = fileData;
        return { fileId: fid, uploader, fileName, cid };
      })
    );
    setFiles(metas);
  }

  async function loadOwner() {
    const ctr = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);
    try {
      const ownerOnChain: string = await ctr.methods
        .getFolderOwner(folderId)
        .call({ from: userAddress });
      setFolderOwner(ownerOnChain.toLowerCase());
    } catch (e) {
      console.error("couldn't fetch owner", e);
    }
  }

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!web3 || !userAddress || !ipfsClient || !selectedFile) return;
    try {
      const toastId = toast.loading("Uploading file...");
      const buffer = new Uint8Array(await selectedFile.arrayBuffer());
      const { cid } = await uploadFolderFile(
        web3,
        ipfsClient,
        userAddress,
        folderId,
        buffer,
        selectedFile.name
      );
      console.log("Uploaded to IPFS CID:", cid);
      toast.dismiss(toastId);
      toast.success("File uploaded successfully");
      setSelectedFile(null);
      loadGroupFiles();
      setDialogOpen(false);
    } catch (err: any) {
      console.error("Upload failed", err);
      alert("Upload failed: " + err.message);
    }
  };

  const handleDownload = async (file: FileMeta) => {
    if (!web3 || !userAddress || !ipfsClient) return;
    try {
      const toastId = toast.loading("Downloading file...");
      const data = await downloadFolderFile(
        web3,
        userAddress,
        folderId,
        file.cid
      );
      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.fileName;
      a.click();
      toast.dismiss(toastId);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Download failed", err);
      alert("Download failed: " + err.message);
    }
  };

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  }

  const deleteFile = async (folderId: number, fileId: number, cid: string) => {
    if (!web3 || !userAddress) {
      toast.error("Wallet not connected");
      return;
    }

    const toastId = toast.loading("Deleting file…");
    const contract = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);

    try {
      // 1) call the on-chain deleteFile(uint256 folderId, uint256 fileId)
      await contract.methods
        .deleteFile(folderId, fileId)
        .send({ from: userAddress });

      await unpinFile(cid);
      // 2) success toast
      toast.success("File deleted");
      toast.dismiss(toastId);

      loadGroupFiles();
    } catch (err: any) {
      console.error("Delete failed", err);
      toast.error("Delete failed: " + err.message);
      toast.dismiss(toastId);
    }
  };

  const handleDeleteFolder = async () => {
    if (!web3 || !userAddress) {
      toast.error("Wallet not connected");
      return;
    }

    const t = toast.loading("Deleting folder…");
    const ctr = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);
    try {
      // 1) fetch file IDs
      const raw: any = await ctr.methods
        .getFolderFiles(folderId)
        .call({ from: userAddress });
      const fileIds: string[] = Array.isArray(raw)
        ? raw
        : Object.keys(raw)
            .filter((k) => k !== "length")
            .map((k) => raw[k]);

      // 2) fetch CIDs (or entire file objects)
      const files = await Promise.all(
        fileIds.map((id) =>
          ctr.methods.getFolderFile(folderId, id).call({ from: userAddress })
        )
      );
      const cids = files.map((f: any) => f.cid);

      // 3) now delete on-chain
      await ctr.methods.deleteFolder(folderId).send({ from: userAddress });

      // 4) unpin off-chain
      await Promise.all(
        cids.map((cid: string) => unpinFile(cid).catch(() => null))
      );

      toast.dismiss(t);
      toast.success("Folder deleted");
      navigate("/in/groups");
    } catch (err: any) {
      console.error("Folder deletion failed", err);
      toast.error("Delete folder failed: " + err.message);
      toast.dismiss(t);
    }
  };

  // filter files by name or cid
  const filteredFiles = files.filter(
    (f) =>
      f.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.cid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.uploader.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLeaveGroup = async () => {
    if (!web3 || !userAddress) {
      toast.error("Wallet not connected");
      return;
    }

    const t = toast.loading("Leaving Group…");
    const ctr = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);

    try {
      await ctr.methods.leaveFolder(folderId).send({ from: userAddress });

      toast.success("Left group folder");
      toast.dismiss(t);
      // redirect back to groups
      navigate("/in/groups");
    } catch (err: any) {
      console.error("Leave group failed", err);
      toast.error("Leave group failed: " + err.message);
      toast.dismiss(t);
    }
  };

  if (isMember === null) {
    // still checking
    return <div>Checking access…</div>;
  }

  if (!id) return <p>Invalid group folder</p>;
  return (
    <div className="px-6 py-4 w-full max-w-7xl mx-auto">
      <div className="w-full flex items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-white">{folderName}</h1>

        {userAddress?.toLowerCase() === folderOwner && (
          <button
            onClick={handleDeleteFolder}
            className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2"
          >
            <Trash2 size={18} /> Delete Folder
          </button>
        )}

        {userAddress?.toLowerCase() != folderOwner && (
          <button
            onClick={handleLeaveGroup}
            className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2"
          >
            <DoorOpen size={18} /> Leave Group
          </button>
        )}

        {(perms & PERM_UPLOAD) !== 0 && (
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
        )}

        <button
          className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded flex items-center gap-2"
          onClick={() => navigate(`/in/groups/${folderId}/members`)}
        >
          <Users size={18} /> Members
        </button>
      </div>

      <div className="relative w-full mb-4">
        <FolderSearch
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Search by Name, CID, or Uploader"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-neutral-800 text-white placeholder-gray-400 pl-10 pr-3 py-2 rounded focus:outline-none"
        />
      </div>

      {/* File Table */}
      <div className="w-full overflow-x-auto rounded-lg">
        <table className="w-full text-left border-collapse text-white bg-black">
          <thead className=" text-white">
            <tr>
              <th className="text-xl p-3 font-semibold border-b border-white text-left">
                Name
              </th>
              <th className="text-xl p-3 font-semibold border-b border-white text-left">
                CID
              </th>
              <th className="text-xl p-3 font-semibold border-b border-white text-left">
                Uploader
              </th>
              <th
                className={`text-xl p-3 font-semibold border-b border-white text-right
                ${(perms & PERM_DELETE) !== 0 ? "" : "invisible"}`}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredFiles.map((file) => (
              <tr
                key={file.cid}
                className="border-b border-white hover:bg-gray-800"
              >
                <td
                  className="p-3 align-middle cursor-pointer hover:underline"
                  onDoubleClick={() => handleDownload(file)}
                >
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
                  {(perms & PERM_DELETE) !== 0 && (
                    <button
                      onClick={() =>
                        deleteFile(folderId, file.fileId, file.cid)
                      }
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-5 h-5 text-red-500 hover:scale-110 transition" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
