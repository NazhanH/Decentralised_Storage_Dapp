// src/components/SidePanel.tsx
import { NavLink } from "react-router-dom";
import "./SidePanel.css"; // Optional: for custom styles
import { useWeb3 } from "../context/Web3Context";
import { FILEVAULT_ABI } from "../contracts/abi";
import { CONTRACT_ADDRESS } from "../contracts/address";
import { unpinFile } from "../ipfs/ipfsServices";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export default function SidePanel() {
  const { web3, userAddress, gatewayReady, gatewayName } = useWeb3();
  const navigate = useNavigate();

  const displayAddress = userAddress
    ? `${userAddress.substring(0, 6)}…${userAddress.slice(-4)}`
    : "MetaMask not connected";

  const handleDeleteAccount = async () => {
    if (!web3 || !userAddress) {
      toast.error("Wallet not connected");
      return;
    }
    if (
      !window.confirm(
        "Are you sure you want to delete your account? This action cannot be undone."
      )
    ) {
      return;
    }

    const ctr = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);
    const t = toast.loading("Deleting account and unpinning files…");

    try {
      //Snapshot personal-file CIDs
      const rawPersonalIds: any = await ctr.methods
        .getPersonalFileIds()
        .call({ from: userAddress });
      const personalIds: string[] = Array.isArray(rawPersonalIds)
        ? rawPersonalIds.map((v) => v.toString())
        : Object.values(rawPersonalIds).map((v: any) => v.toString());

      const personalFileObjs = await Promise.all(
        personalIds.map((fid) =>
          ctr.methods.getPersonalFile(fid).call({ from: userAddress })
        )
      );
      const personalCids = personalFileObjs.map((f: any) => f.cid as string);

      //Snapshot owned-folder file CIDs
      const rawOwned: any = await ctr.methods
        .getMyOwnedFolderIds()
        .call({ from: userAddress });
      const ownedFolders: number[] = Array.isArray(rawOwned)
        ? rawOwned.map((v: any) => Number(v))
        : Object.values(rawOwned).map((v: any) => Number(v));

      const folderCids: string[] = [];
      for (const folderId of ownedFolders) {
        const rawFileIds: any = await ctr.methods
          .getFolderFiles(folderId)
          .call({ from: userAddress });
        const fileIds: string[] = Array.isArray(rawFileIds)
          ? rawFileIds.map((v) => v.toString())
          : Object.values(rawFileIds).map((v: any) => v.toString());

        const fileObjs: { cid: string }[] = await Promise.all(
          fileIds.map(
            (fid) =>
              ctr.methods
                .getFolderFile(folderId, fid)
                .call({ from: userAddress }) as Promise<{ cid: string }>
          )
        );

        for (const f of fileObjs) {
          folderCids.push(f.cid as string);
        }
      }

      //Delete everything on-chain
      await ctr.methods.deleteMyAccount().send({ from: userAddress });

      //Unpin all the CIDs collected
      const allCids = [...personalCids, ...folderCids];
      await Promise.all(
        allCids.map(async (cid) => {
          try {
            await unpinFile(cid);
            console.log(`Unpinned: ${cid}`);
          } catch (err: any) {
            const status = err.response?.status ?? err.status;
            if (status === 404) {
              console.warn(`CID not found on cluster, skipping: ${cid}`);
            } else {
              console.error(`Failed to unpin ${cid}:`, err);
            }
          }
        })
      );

      toast.success("Account deleted successfully.");
      navigate("/");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account: " + error.message);
    } finally {
      toast.dismiss(t);
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
