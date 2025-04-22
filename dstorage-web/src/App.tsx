
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

import { Text, View } from "react-native";
//import 'react-native-url-polyfill/auto';

import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { createHelia } from 'helia';
import { unixfs } from '@helia/unixfs';
//import { toString } from 'uint8arrays/to-string';
//import { fromString } from 'uint8arrays/from-string';
import React, { useEffect, useState } from 'react';


declare let window: any; // MetaMask & Ethereum provider

// Replace with your actual smart contract info
const contractABI: AbiItem[] = [/* your ABI here */];
const contractAddress: string = '0xYourContractAddress';

interface FileMeta {
  name: string;
  cid: string;
}

const App: React.FC = () => {
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [userAddress, setUserAddress] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<FileMeta[]>([]);
  const [heliaFS, setHeliaFS] = useState<ReturnType<typeof unixfs> | null>(null);

  useEffect(() => {
    // Setup web3 & Helia on load
    if (window.ethereum) {
      const initWeb3 = new Web3(window.ethereum);
      setWeb3(initWeb3);
    }

    const setupHelia = async () => {
      const heliaNode = await createHelia();
      const fs = unixfs(heliaNode);
      setHeliaFS(fs);
    };

    setupHelia();
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) return alert('Install MetaMask');
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const accounts = await web3?.eth.getAccounts();
      setUserAddress(accounts?.[0] || '');
    } catch (err) {
      console.error('Wallet connect error:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const uploadToHelia = async (): Promise<string> => {
    if (!selectedFile || !heliaFS) throw new Error('Missing file or Helia not ready');

    const arrayBuffer = await selectedFile.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const cid = await heliaFS.addBytes(bytes);
    console.log('Uploaded to Helia with CID:', cid.toString());
    return cid.toString();
  };

  const uploadFileToBlockchain = async () => {
    if (!web3 || !userAddress || !selectedFile || !heliaFS) return;

    try {
      const cid = await uploadToHelia();
      const contract = new web3.eth.Contract(contractABI, contractAddress);
      await contract.methods.uploadFile(selectedFile.name, cid).send({ from: userAddress });
      alert('File uploaded!');
      fetchMyFiles();
    } catch (err) {
      console.error('Blockchain upload error:', err);
    }
  };

  const fetchMyFiles = async () => {
    if (!web3 || !userAddress) return;
    const contract = new web3.eth.Contract(contractABI, contractAddress);
    const files: FileMeta[] = await contract.methods.getMyFiles().call({ from: userAddress });
    setUploadedFiles(files);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Decentralized Storage dApp (w/ Helia + MetaMask)</h2>

      <button onClick={connectWallet}>
        {userAddress ? `Connected: ${userAddress}` : 'Connect MetaMask'}
      </button>

      <div style={{ marginTop: '1rem' }}>
        <input type="file" onChange={handleFileChange} />
        <button onClick={uploadFileToBlockchain} disabled={!selectedFile || !userAddress}>
          Upload File
        </button>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>Uploaded Files</h3>
        <ul>
          {uploadedFiles.map((file, index) => (
            <li key={index}>
              <strong>{file.name}:</strong>{' '}
              <a href={`https://ipfs.io/ipfs/${file.cid}`} target="_blank" rel="noopener noreferrer">
                View on IPFS
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default App;
