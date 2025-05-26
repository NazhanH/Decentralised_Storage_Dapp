// src/context/Web3Context.tsx
import React, {createContext, useContext, useState, useEffect} from 'react'
import Web3 from 'web3'
import { getEndpoint, initIPFSEndpoint,getIPFSClient} from '../ipfs/ipfsClients'
import { IPFSHTTPClient } from 'ipfs-http-client'

interface Web3State {
  web3: Web3 | null
  userAddress: string
  connectWallet: () => Promise<void>
  gatewayReady: boolean
  gatewayName: string
  ipfsClient: IPFSHTTPClient | null
}

declare let window: any

const Web3Ctx = createContext<Web3State | null>(null)

export const useWeb3 = () => {
  const ctx = useContext(Web3Ctx)
  if (!ctx) throw new Error('useWeb3 must be <Web3Provider>')
  return ctx
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [web3, setWeb3]         = useState<Web3|null>(null);
  const [userAddress,   setUserAddress] = useState('')
  const [gatewayReady,  setGatewayReady]  = useState(false)
  const [gatewayName,   setGatewayName]   = useState('')
  const [ipfsClient, setIpfsClient]     = useState<IPFSHTTPClient|null>(null)
  //let web3: Web3

  async function connectWallet() {
    if (!window.ethereum) throw new Error('No MetaMask')
    await window.ethereum.request({ method: 'eth_requestAccounts' })
    const w3 = new Web3(window.ethereum)
    //web3 = w3
    const accounts = await w3.eth.getAccounts()
    setUserAddress(accounts[0]||'')
  }

    // initialize once
  useEffect(() => {
    if (window.ethereum) {
      const w3 = new Web3(window.ethereum)
      setWeb3(w3)

      // load accounts
      w3.eth.getAccounts().then(a => setUserAddress(a[0] || ''))

      // init IPFS
      initIPFSEndpoint().then(() => {
        setGatewayReady(true)
        setGatewayName(getEndpoint().name)

      // grab the ready‐to‐use client
      const client = getIPFSClient()
      setIpfsClient(client)
      })
    }
  }, [])

   
    useEffect(() => {
      if (window.ethereum) {
  
        //Get currently-selected account (if already connected)
        window.ethereum
          .request({ method: 'eth_accounts' })
          .then((accounts: string[]) => {
            if (accounts.length) setUserAddress(accounts[0])
          })
  
        //Listen for account switches
        const handleAccountsChanged = (accounts: string[] = []) => {
          setUserAddress(accounts[0] || '')
        }
        window.ethereum.on('accountsChanged', handleAccountsChanged)
  
        return () => {
          window.ethereum.removeListener(
            'accountsChanged',
            handleAccountsChanged
          )
        }
      }
      else {
        alert('Please install MetaMask')
      }
    }, [])



  return (
    <Web3Ctx.Provider value={{ web3, userAddress, connectWallet, gatewayReady, gatewayName, ipfsClient}}>
      {children}
    </Web3Ctx.Provider>
  )
}


