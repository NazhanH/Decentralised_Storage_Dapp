import './App.css'
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import PersonalFolders from './pages/PersonalFolders';
import PersonalFiles from './pages/PersonalFiles';
import Groups from './pages/Groups';
import FolderFiles from './pages/FolderFiles';
import GroupFiles from './pages/GroupFiles';
import { Web3Provider } from './context/Web3Context';


const App: React.FC = () => {

  return (

    <Web3Provider>
     <BrowserRouter>
      <Routes>
        {/* Layout wraps all routes with the sidebar */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/personal" replace />} />
          <Route path="personal" element={<PersonalFiles />} />
          <Route path="folders"  element={<PersonalFolders  />} />
          <Route path="folders/:id"   element={<FolderFiles />} />
          <Route path="groups"        element={<Groups />} />
          <Route path="groups/:id"    element={<GroupFiles />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </Web3Provider>
  )
}

export default App
