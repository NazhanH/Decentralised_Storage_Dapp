import './App.css'
import React, { useEffect, useState } from 'react'
import Web3 from 'web3'
import { createHelia } from 'helia'
import { unixfs } from '@helia/unixfs'
import { createLibp2p } from 'libp2p'
import {webSockets} from '@libp2p/websockets'
import { tcp } from '@libp2p/tcp'
import { mplex } from '@libp2p/mplex'
import { noise } from '@chainsafe/libp2p-noise'
import { bootstrap } from '@libp2p/bootstrap'
import { MemoryDatastore } from 'datastore-core'

import { create as createIPFSClient, IPFSHTTPClient } from 'ipfs-http-client'

import { FILEVAULT_ABI } from './contracts/abi'
import { CONTRACT_ADDRESS } from './contracts/address'

declare let window: any

// Create an IPFS client instance
const ipfs: IPFSHTTPClient = createIPFSClient({url: 'http://192.168.0.135:5001/api/v0'})


// // Build a Helia FS that peers with your local IPFS daemon
// async function makeHeliaConnectedToLocalIPFS() {
//   const localPeerMultiaddr = '/ip4/192.168.0.135/tcp/4001/2p/12D3KooWCbKg1gcqtMwUqhU78kyuP9QSTXuih35jk2KeZdhLWbzb'

//   const libp2p = await createLibp2p({
//     datastore: new MemoryDatastore(),
//     transports: [webSockets()],
//     streamMuxers: [mplex()],
//     connectionEncrypters: [noise()],
//     peerDiscovery: [bootstrap({ list: [localPeerMultiaddr] })],
//   })

//   const helia = await createHelia({ libp2p })
//   console.log('Helia connected to local IPFS:', helia)
//   return unixfs(helia)
// }

interface FileMeta {
  fileName: string
  cid: string
}

const App: React.FC = () => {
  const [web3, setWeb3] = useState<Web3 | null>(null)
  const [userAddress, setUserAddress] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<FileMeta[]>([])
  // const [heliaFS, setHeliaFS] = useState<ReturnType<typeof unixfs> | null>(
  //   null
  // )

  useEffect(() => {
    // a) Init Web3
    if (window.ethereum) {
      const w3 = new Web3(window.ethereum)
      setWeb3(w3)

      // 1️⃣ Get currently-selected account (if already connected)
      window.ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length) setUserAddress(accounts[0])
        })

      // 2️⃣ Listen for account switches
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
  }, [])

  useEffect(() => {
    if (web3 && userAddress) {
      fetchMyFiles()
    }
  }, [web3, userAddress])


  // useEffect(() => {
  //   ;(async () => {
  //     console.log('⏳ [Helia] initializing…')
  //     try {
  //       const fs = await makeHeliaConnectedToLocalIPFS()
  //       console.log('✅ [Helia] fs ready:', fs)
  //       setHeliaFS(fs)
  //     } catch (err) {
  //       console.error('❌ [Helia] init failed:', err)
  //     }
  //   })()
  // }, [])
  
  /** 
 * Uploads the selected file to your local IPFS daemon
 * via HTTP and returns its CID.
 */
  // const uploadToIPFSDaemon = async (): Promise<string> => {
  //   if (!selectedFile) throw new Error('No file selected')
    
  //   // ipfs.add returns an object with a .cid property
  //   const result = await ipfs.add(selectedFile)
  //   console.log('✅ Uploaded to IPFS daemon, CID =', result.cid.toString())
  //   return result.cid.toString()
  // }

  async function uploadToIPFSDaemon(file: File): Promise<string> {
    const result = await ipfs.add(file)
    console.log('✅ Added to IPFS daemon, CID =', result.cid.toString())
    return result.cid.toString()
  }

  const connectWallet = async () => {
    if (!window.ethereum) return alert('Please install MetaMask')
    try {
      // prompts MetaMask and returns exactly the allowed account
      const accounts: string[] = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      console.log('Connected accounts:', accounts)
      setUserAddress(accounts[0] || '')
    } catch (err) {
      console.error('Wallet connect error:', err)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setSelectedFile(e.target.files[0])
  }

  // const uploadToHelia = async (): Promise<string> => {
  //   if (!selectedFile || !heliaFS) throw new Error('Helia not ready or no file')
  //   const bytes = new Uint8Array(await selectedFile.arrayBuffer())
  //   const cid = await heliaFS.addBytes(bytes)
  //   console.log('Uploaded to Helia:', cid.toString())
  //   return cid.toString()
  // }

  const uploadFileToBlockchain = async () => {
    console.log('Uploading files to blockchain triggered')
    console.log('selectedFile:', selectedFile)
    console.log('userAddress:', userAddress)
    // console.log('heliaFS ready?', !!heliaFS)
    if (!web3 || !userAddress || !selectedFile ) return
    try {
      const cid = await uploadToIPFSDaemon(selectedFile)
      console.log('Uploading to blockchain with CID:', cid)
      const contract = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);

    // estimate gas first, to catch estimation errors
    const gas = await contract.methods
      .uploadFile(selectedFile.name, cid)
      .estimateGas({ from: userAddress });
    console.log('Estimated gas:', gas);

    const gasPrice = await web3.eth.getGasPrice();
    console.log('Gas price:', gasPrice);

      await contract.methods
        .uploadFile(selectedFile.name, cid)
        .send({ from: userAddress, gas: gas.toString(), gasPrice: gasPrice.toString() });
      console.log('File uploaded successfully:')
      await fetchMyFiles()
    } catch (err:any) {
      console.error('❌ Upload error (full):', err);
      //console.error('⛔️ call() revert reason:', callErr.message)
      console.error('err.message:', err.message);
      console.error('err.data:', err.data);
      console.error('err.stack:', err.stack);
    }
  }

  const fetchMyFiles = async () => {
    if (!web3 || !userAddress) return
    const contract = new web3.eth.Contract(
      FILEVAULT_ABI,
      CONTRACT_ADDRESS
    )
    const files: FileMeta[] = await contract.methods
      .getMyFiles()
      .call({ from: userAddress })
    setUploadedFiles(files)
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Decentralized Storage dApp</h2>

      <button onClick={connectWallet}>
        {userAddress
          ? `Connected: ${userAddress.substring(0, 6)}…${userAddress.slice(
              -4
            )}`
          : 'Connect MetaMask'}
      </button>

      <button  onClick={() => {
            console.log('i am clicked');
          }}>
        click me
      </button>

      <div style={{ marginTop: '1rem' }}>
        <input type="file" onChange={handleFileChange} />
        <button
           onClick={() =>uploadFileToBlockchain()}
          disabled={!selectedFile || !userAddress}
        >
          Upload File
        </button>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>Uploaded Files</h3>
        <ul>
          {uploadedFiles.map((file, i) => (
            <li key={i}>
              <strong>{file.fileName}</strong>{' '}
              <a
                href={`http://192.168.0.135:8080/ipfs/${file.cid}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                view
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default App
