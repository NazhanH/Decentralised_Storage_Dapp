// src/pages/LandingPage.tsx
import { useEffect, useState } from "react";
import { useWeb3 } from "../context/Web3Context";
import { FILEVAULT_ABI } from "../contracts/abi";
import { CONTRACT_ADDRESS } from "../contracts/address";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

declare let window: any;

export default function LandingPage() {
  const { web3, userAddress, connectWallet } = useWeb3();
  const navigate = useNavigate();

  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // On mount (or whenever web3/userAddress changes), check if the user has already registered a public key
  useEffect(() => {
    if (!web3 || !userAddress) {
      setIsRegistered(null);
      return;
    }
    checkRegistration();
  }, [web3, userAddress]);

  // 1) On mount: if no wallet connected, trigger the connect flow
  useEffect(() => {
    if (!userAddress && web3) {
      connectWallet().catch((err: any) => {
        console.error("Failed to connect wallet:", err);
        setError("Please connect your wallet to continue.");
      });
    }
    // only run once on mount or if web3 becomes available
  }, [web3, connectWallet, userAddress]);

  async function checkRegistration() {
    if (!web3 || !userAddress) return;
    const toastId = toast.loading("Checking registration...");
    try {
      const contract = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);
      // encryptionKeys[userAddress] is an empty string if not yet registered
      const existingKey: string = await contract.methods
        .encryptionKeys(userAddress)
        .call({ from: userAddress });

      setIsRegistered(existingKey.length > 0);
      toast.dismiss(toastId); // clears the loading toast
      toast.success("You're registered!"); // or other success messages
    } catch (err: any) {
      console.error("Registration check failed", err);
      setError("Failed to check registration. Please try again.");
      toast.dismiss(toastId); // clears the loading toast
      toast.error(error); // or other success messages
    }
  }

  async function handleRegister() {
    if (!userAddress) return;
    const loadingToast = toast.loading("Registring..."); // or "Registering..."
    try {
      setError(null);
      // 1) Request the user's EIP-747 encryption public key from MetaMask
      const pubKey: string = await window.ethereum.request({
        method: "eth_getEncryptionPublicKey",
        params: [userAddress],
      });

      // 2) Call registerEncryptionKey(pubKey) on-chain
      const contract = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);
      await contract.methods
        .registerEncryptionKey(pubKey)
        .send({ from: userAddress });

      // 3) force a re-check of on‐chain state so context.isRegistered flips true
      await checkRegistration();
      toast.dismiss(loadingToast); // clears the loading toast
      toast.success("Registered successfully!");
      window.location.reload();
    } catch (err: any) {
      console.error("Registration failed", err);
      if (err.code === 4001) {
        setError("MetaMask request was rejected.");
      } else {
        setError("Registration transaction failed.");
      }
      toast.dismiss(loadingToast);
      toast.error("Failed to register"); // etc.
    }
  }

  // if (isRegistered === null) {
  //   return null
  // }

  // 1) Wallet not yet connected
  if (!userAddress) {
    return (
      <div style={{ textAlign: "center", marginTop: "4rem" }}>
        <p>Connecting your wallet…</p>
      </div>
    );
  }

  if (!isRegistered) {
    // First-time user: show registration UI
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-4">
          Welcome to <span className="text-blue-400">FileVault</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-300 mb-6 max-w-xl">
          To get started, you need to register your Metamask encryption public
          key. This enables your files to be encrypted.
        </p>
        <button
          className="bg-purple-600 hover:bg-purple-700 transition text-white font-semibold px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={false}
          onClick={handleRegister}
        >
          Register Public Key
        </button>
      </div>
    );
  }

  // Registered user: show navigation to personal & group folders
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-5xl md:text-6xl font-bold mb-4">Welcome back!</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <button
          onClick={() => navigate("/in/personal")}
          disabled={false}
          style={{
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Enter
        </button>
      </div>
    </div>
  );
}
