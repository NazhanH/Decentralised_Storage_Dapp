// src/components/SidePanel.tsx
import { NavLink } from 'react-router-dom'
import './SidePanel.css' // Optional: for custom styles
import {useWeb3} from '../context/Web3Context'

export default function SidePanel() {

  const { userAddress, connectWallet, gatewayReady, gatewayName } = useWeb3()
  return (
        <aside className="side-panel">
      <h1 className="logo">Filevault</h1>

       <button onClick={connectWallet} className="connect-btn">
        {userAddress
          ? `🦊 ${userAddress.substring(0,6)}…${userAddress.slice(-4)}`
          : 'Connect MetaMask'}
      </button>

      {/* ← IPFS gateway status */}
      <p className={`gateway-status ${gatewayReady ? 'ready' : 'not-ready'}`}>
        {gatewayReady
          ? `🛰️ IPFS: ${gatewayName} ready`
          : '⚠️ IPFS not ready'}
      </p>

      <nav>
       <NavLink to="/personal" end  className={({ isActive }) =>isActive ? 'nav-link active' : 'nav-link'}>Personal Files</NavLink>
       <NavLink to="/folders" end  className={({ isActive }) =>isActive ? 'nav-link active' : 'nav-link'}>Personal Folders</NavLink>
       <NavLink to="/groups" end  className={({ isActive }) =>isActive ? 'nav-link active' : 'nav-link'}>Groups</NavLink>
      </nav>
    </aside>
  )
}
