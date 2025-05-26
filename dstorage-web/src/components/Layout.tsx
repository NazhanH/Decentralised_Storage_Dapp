// src/components/Layout.tsx
import { Outlet } from 'react-router-dom'
import SidePanel from './SidePanel'
import './Layout.css' // Optional: for custom styles

export default function Layout() {
  return (
    <div className="app-container">
      <SidePanel />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
