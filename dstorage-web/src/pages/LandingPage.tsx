// src/pages/LandingPage.tsx
import React, { useEffect, useState } from 'react'
import { useWeb3 } from '../context/Web3Context'
import { FILEVAULT_ABI } from '../contracts/abi'
import { CONTRACT_ADDRESS } from '../contracts/address'
import { useNavigate } from 'react-router-dom'

declare let window: any

export default function LandingPage() {
  const { web3, userAddress } = useWeb3()
  const navigate = useNavigate()

  const [isRegistered, setIsRegistered] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // On mount (or whenever web3/userAddress changes), check if the user has already registered a public key
  useEffect(() => {
    if (!web3 || !userAddress) {
      setIsRegistered(null)
      return
    }
    checkRegistration()
  }, [web3, userAddress])

  async function checkRegistration() {
    try {
      setLoading(true)
      const contract = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS)
      // encryptionKeys[userAddress] is an empty string if not yet registered
      const existingKey: string = await contract.methods
        .encryptionKeys(userAddress)
        .call({ from: userAddress })

      setIsRegistered(existingKey.length > 0)
      setLoading(false)
    } catch (err: any) {
      console.error('Registration check failed', err)
      setError('Failed to check registration. Please try again.')
      setLoading(false)
    }
  }

  async function handleRegister() {
    if (!userAddress) return
    try {
      setError(null)
      setLoading(true)
      // 1) Request the user's EIP-747 encryption public key from MetaMask
      const pubKey: string = await window.ethereum.request({
        method: 'eth_getEncryptionPublicKey',
        params: [userAddress]
      })

      // 2) Call registerEncryptionKey(pubKey) on-chain
      const contract = new web3!.eth.Contract(FILEVAULT_ABI, CONTRACT_ADDRESS)
      await contract.methods
        .registerEncryptionKey(pubKey)
        .send({ from: userAddress })

      // 3) Mark as registered and stop loading
      setIsRegistered(true)
      setLoading(false)
    } catch (err: any) {
      console.error('Registration failed', err)
      if (err.code === 4001) {
        setError('MetaMask request was rejected.')
      } else {
        setError('Registration transaction failed.')
      }
      setLoading(false)
    }
  }

  if (loading || isRegistered === null) {
    return (
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <p>Loading…</p>
      </div>
    )
  }

  if (!isRegistered) {
    // First-time user: show registration UI
    return (
      <div style={{ maxWidth: 400, margin: '2rem auto', textAlign: 'center' }}>
        <h1>Welcome to FileVault</h1>
        <p>
          To get started, you need to register your encryption public key. This
          enables your files to be encrypted.
        </p>
        {error && (
          <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>
        )}
        <button
          onClick={handleRegister}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Registering…' : 'Register Public Key'}
        </button>
      </div>
    )
  }

  // Registered user: show navigation to personal & group folders
  return (
    <div style={{ maxWidth: 500, margin: '2rem auto', textAlign: 'center' }}>
      <h1>Welcome!</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <button
          onClick={() => navigate('/in/personal')}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            cursor: 'pointer'
          }}
        >
          Enter
        </button>
      </div>
    </div>
  )
}
