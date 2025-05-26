import React, { useEffect, useState } from "react";
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

  // fetch files on load or change to web3 or userAddress
  useEffect(() => {
    if (web3 && userAddress) {
      fetchMyFiles();
    }
  }, [web3, userAddress]);

  // handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
  };

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
      setSelectedFile(null);
      await fetchMyFiles();
    } catch (e: any) {
      console.error("Upload failed", e);
      alert("Upload failed: " + (e as Error).message);
    }
  };

  // 3️⃣ Handle download
  const handleDownload = async (file: FileMeta) => {
    if (!ipfsClient) return;
    const pass = window.prompt(`Passphrase for "${file.fileName}":`) || "";
    if (!pass) return;

    try {
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


  return (
    <div>
      <div>
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleUpload} disabled={!selectedFile || !userAddress}>
          Upload File
        </button>
      </div>

      <div>
        <h3>Uploaded Files </h3>
        <ul>
          {uploadedFiles.map((file, i) => {
            return (
              <li key={i}>
                {file.fileName}{" "}
                <button onClick={() => handleDownload(file)}>
                  Download & Decrypt {file.fileName} {file.cid}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
