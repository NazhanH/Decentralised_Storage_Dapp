import './App.css'
import React, { useEffect, useState } from 'react'
import Web3 from 'web3'
import { initIPFSEndpoint, getIPFSClient, getGatewayUrl, getEndpoint} from './ipfsClients'
import { FILEVAULT_ABI } from './contracts/abi'
import { CONTRACT_ADDRESS } from './contracts/address'

declare let window: any

interface FileMeta {
  fileName: string
  cid: string
}

const App: React.FC = () => {
  const [web3, setWeb3] = useState<Web3 | null>(null)
  const [userAddress, setUserAddress] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<FileMeta[]>([])
  const [gatewayReady, setGatewayReady] = useState(false)


  //init web3
  useEffect(() => {
    // a) Init Web3
    if (window.ethereum) {
      const w3 = new Web3(window.ethereum)
      setWeb3(w3)

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
  }, [])

  // init IPFS
  useEffect(() => {
    initIPFSEndpoint() .then(() => {
      setGatewayReady(true) 
    })
  }, [])


  // fetch files on load or change to web3 or userAddress
  useEffect(() => {
    if (web3 && userAddress) {
      fetchMyFiles()
    }
  }, [web3, userAddress])


  // upload file to IPFS
  async function uploadToIPFSDaemon(file: File): Promise<string> {
    const ipfs = getIPFSClient()
    const result = await ipfs.add(file)
    console.log('✅ Added to IPFS daemon, CID =', result.cid.toString())
    return result.cid.toString()
  }

  //connect to wallet
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

  // handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setSelectedFile(e.target.files[0])
  }


  // upload file to IPFS and then to smart contract
  const uploadFileToIPFS = async () => {
    console.log('Uploading files to IPFS triggered')
    console.log('selectedFile:', selectedFile)
    console.log('userAddress:', userAddress)

    if (!web3 || !userAddress || !selectedFile ) return
    try {
      const cid = await uploadToIPFSDaemon(selectedFile)
      console.log('Uploading to IPFS with CID:', cid)
      const contract = new web3.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS);

    // estimate gas first, to catch estimation errors
    const gas = await contract.methods
      .uploadFile(selectedFile.name, cid)
      .estimateGas({ from: userAddress });
    console.log('Estimated gas:', gas);

    const gasPrice = await web3.eth.getGasPrice();
    console.log('Gas price:', gasPrice);

      // send transaction and data to smart contract
      await contract.methods
        .uploadFile(selectedFile.name, cid)
        .send({ from: userAddress, gas: gas.toString(), gasPrice: gasPrice.toString() });
      console.log('File upload successful')
      await fetchMyFiles()
    } catch (err:any) {
      console.error('❌ Upload error (full):', err);
      console.error('err.message:', err.message);
      console.error('err.data:', err.data);
      console.error('err.stack:', err.stack);
    }
  }

  // fetch detail of files from smart contract and fetch from ipfs
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

      {gatewayReady ? (
        <p style={{ color: 'green' }}>IPFS Gateway {getEndpoint().name} is ready</p>
      ) : (
        <p style={{ color: 'red' }}>IPFS Gateway is not ready</p>
      )}

      <div style={{ marginTop: '1rem' }}>
        <input type="file" onChange={handleFileChange} />
        <button
           onClick={() =>uploadFileToIPFS()}
          disabled={!selectedFile || !userAddress}
        >
          Upload File
        </button>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>Uploaded Files</h3>
        <ul>
          {uploadedFiles.map((file, i) => {
            const url = getGatewayUrl(file.cid)
            const isImage = /\.(png|jpe?g|gif)$/i.test(file.fileName)
            const isPDF   = /\.pdf$/i.test(file.fileName)
            const isVideo = /\.(mp4|webm|ogg)$/i.test(file.fileName)

            return (
              <li key={i} style={{ marginBottom: '1rem' }}>
                {/* 1) Clickable file name */}
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {file.fileName}
                </a>

                {/* 2) Inline preview for images */}
                {isImage && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <img
                      src={url}
                      alt={file.fileName}
                      style={{ maxWidth: '200px', maxHeight: '200px' }}
                    />
                  </div>
                )}

                {/* 3) Inline embed for PDFs */}
                {isPDF && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <iframe
                      src={url}
                      title={file.fileName}
                      style={{ width: '100%', height: '400px', border: '1px solid #ccc' }}
                    />
                  </div>
                )}
                
                {/* 4) Inline video thumbnail for videos */}
                {isVideo && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <video
                      src={url}
                      controls
                      style={{ width: '100%', maxHeight: '400px', border: '1px solid #ccc' }}
                    />
                  </div>
                )}

              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export default App
