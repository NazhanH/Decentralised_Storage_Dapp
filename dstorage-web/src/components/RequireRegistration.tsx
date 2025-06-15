// src/components/RequireRegistration.tsx
import React from 'react'
import { Navigate } from 'react-router-dom'
import { useWeb3 } from '../context/Web3Context'

/**
 * This component wraps any children that should only be visible if
 * the user is registered (i.e. has an encryption key on‐chain).
 *
 * - If isRegistered === null, show a “loading…” message.
 * - If isRegistered === false, redirect to /register.
 * - If isRegistered === true, render the children normally.
 */
export default function RequireRegistration({
  children,
}: {
  children: React.ReactNode
}) {
  const { isRegistered } = useWeb3()

  if (isRegistered === null) {
    // still loading or no wallet connected yet
    return <p style={{ textAlign: 'center', marginTop: '2rem' }}>Checking registration…</p>
  }

  if (!isRegistered) {
    // not registered → send them to /register
    return <Navigate to="/" replace />
  }

  // isRegistered === true → allow access
  return <>{children}</>
}
