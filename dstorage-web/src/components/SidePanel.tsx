// src/components/SidePanel.tsx
import { NavLink } from "react-router-dom";
import "./SidePanel.css"; // Optional: for custom styles
import { useWeb3 } from "../context/Web3Context";
import { FILEVAULT_ABI } from "../contracts/abi";
import { CONTRACT_ADDRESS } from "../contracts/address";
import { unpinFile } from "../ipfs/ipfsServices";
import toast from "react-hot-toast";

export default function SidePanel() {
  const { web3, userAddress, gatewayReady, gatewayName } = useWeb3();

  const displayAddress = userAddress
    ? `${userAddress.substring(0, 6)}…${userAddress.slice(-4)}`
    : "MetaMask not connected";

  const handleDeleteAccount = async () => {
    if (!userAddress || !web3) return;
    if (
      !window.confirm(
        "Are you sure you want to delete your account? This action cannot be undone."
      )
    )
      return;

    try {
      const contract = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);
      const t = toast.loading("Deleting account and unpinning files…");

      await contract.methods.deleteMyAccount().send({ from: userAddress });

      // --- 1) fetch all personal file IDs
      // get raw ids (could be array or object)
      const rawIds: any = await contract.methods
        .getPersonalFileIds()
        .call({ from: userAddress });
      const PersonalIds: string[] = Array.isArray(rawIds)
        ? rawIds
        : Object.values(rawIds).map((v: any) => v.toString());

      // --- 2) for each fileId, grab its CID then unpin it
      for (const fid of PersonalIds) {
        // web3 returns {0: name,1:cid, fileName: string, cid: string}
        const fileObj: { fileName: string; cid: string } =
          await contract.methods
            .getPersonalFile(fid)
            .call({ from: userAddress });

        try {
          await unpinFile(fileObj.cid);
          console.log(`Unpinned: ${fileObj.cid}`);
        } catch (err: any) {
          // if it's a 404 from your IPFS‐cluster endpoint
          const status = err.response?.status ?? err.status;
          if (status === 404) {
            console.warn(`File ${fileObj.cid} not found in cluster, skipping.`);
          } else {
            // rethrow any other error so the outer catch will handle it
            throw err;
          }
        }
      }

      const rawOwned: any = await contract.methods
        .getMyOwnedFolderIds()
        .call({ from: userAddress });
      const ownedFolders: number[] = Array.isArray(rawOwned)
        ? rawOwned.map((v: any) => Number(v))
        : Object.values(rawOwned).map((v: any) => Number(v));

      for (const folderId of ownedFolders) {
        // fetch file IDs in this folder
        const rawFileIds: any = await contract.methods
          .getFolderFiles(folderId)
          .call({ from: userAddress });
        const fileIds: string[] = Array.isArray(rawFileIds)
          ? rawFileIds
          : Object.values(rawFileIds).map((v: any) => v.toString());

        // unpin each file in that folder
        for (const fid of fileIds) {
          const fileObj: { uploader: string; fileName: string; cid: string } =
            await contract.methods
              .getFolderFile(folderId, fid)
              .call({ from: userAddress });

          const cid = fileObj.cid;
          await unpinFile(cid);
          console.log(`Unpinned folder file: ${cid}`);
        }
      }

      alert("Account deleted successfully.");
      toast.success("Account deleted successfully.");
      toast.dismiss(t);
      window.location.reload();
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Failed to delete account. Please try again later.");
    }
  };

  return (
    <aside className="side-panel">
      <h1 className="logo">Filevault</h1>

      <div className="address-display">{displayAddress}</div>

      {/* ← IPFS gateway status */}
      <p className={`gateway-status ${gatewayReady ? "ready" : "not-ready"}`}>
        {gatewayReady ? `IPFS: ${gatewayName} ready` : "⚠️ IPFS not ready"}
      </p>

      <nav>
        <NavLink
          to="/in/personal"
          end
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          Personal Files
        </NavLink>
        <NavLink
          to="/in/folders"
          end
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          Personal Folders
        </NavLink>
        <NavLink
          to="/in/groups"
          end
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          Groups
        </NavLink>
      </nav>

      <div className="footer">
        <button onClick={handleDeleteAccount}>Delete Account</button>
      </div>
    </aside>
  );
}
