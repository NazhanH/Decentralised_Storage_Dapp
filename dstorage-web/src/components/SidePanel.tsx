// src/components/SidePanel.tsx
import { NavLink } from 'react-router-dom'
import './SidePanel.css' // Optional: for custom styles
import {useWeb3} from '../context/Web3Context'
import { FILEVAULT_ABI } from '../contracts/abi'
import { CONTRACT_ADDRESS } from '../contracts/address'

export default function SidePanel() {

  const {web3,  userAddress, gatewayReady, gatewayName } = useWeb3()

  const displayAddress = userAddress
  ? `${userAddress.substring(0, 6)}…${userAddress.slice(-4)}`
  : 'MetaMask not connected'

  const handleDeleteAccount = async () => {
    if (!userAddress|| !web3) return
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) return

    try {
      const contract = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS)
      await contract.methods.deleteMyAccount().send({ from: userAddress })

      alert('Account deleted successfully.')
      window.location.reload()
    } catch (error) {
      console.error('Error deleting account:', error)
      alert('Failed to delete account. Please try again later.')
    }
  }

  return (
        <aside className="side-panel">
      <h1 className="logo">Filevault</h1>

      <div className="address-display">
        {displayAddress}
      </div>
      
      {/* ← IPFS gateway status */}
      <p className={`gateway-status ${gatewayReady ? 'ready' : 'not-ready'}`}>
        {gatewayReady
          ? `IPFS: ${gatewayName} ready`
          : '⚠️ IPFS not ready'}
      </p>

      <nav>
       <NavLink to="/in/personal" end  className={({ isActive }) =>isActive ? 'nav-link active' : 'nav-link'}>Personal Files</NavLink>
       <NavLink to="/in/folders" end  className={({ isActive }) =>isActive ? 'nav-link active' : 'nav-link'}>Personal Folders</NavLink>
       <NavLink to="/in/groups" end  className={({ isActive }) =>isActive ? 'nav-link active' : 'nav-link'}>Groups</NavLink>
      </nav>

      <div className="footer">
       <button onClick={handleDeleteAccount}>
         Delete Account
       </button>
     </div>
    </aside>
  )
}
