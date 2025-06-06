import './App.css'
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import RequireRegistration from './components/RequireRegistration'
import PersonalFolders from './pages/PersonalFolders';
import PersonalFiles from './pages/PersonalFiles';
import Groups from './pages/Groups';
import FolderFiles from './pages/FolderFiles';
import GroupFiles from './pages/GroupFiles';
import LandingPage from './pages/LandingPage'
import GroupMembers from './pages/GroupMembers';
import { Toaster } from 'react-hot-toast'

import { Web3Provider } from './context/Web3Context';


const App: React.FC = () => {

  return (


    <Web3Provider>
      <Toaster position="top-center" />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />

            {/* Layout wraps all routes with the sidebar */}
            <Route path="/in" element={<RequireRegistration><Layout /></RequireRegistration>}>
              <Route index element={<Navigate to="/personal" replace />} />
              <Route path="personal" element={<PersonalFiles />} />
              <Route path="folders"  element={<PersonalFolders  />} />
              <Route path="folders/:id"   element={<FolderFiles />} />
              <Route path="groups"        element={<Groups />} />
              <Route path="groups/:id"    element={<GroupFiles />} />
              <Route path="groups/:id/members"    element={<GroupMembers />} />
            </Route>
          </Routes>
        </BrowserRouter>
      
    </Web3Provider>
  )
}

export default App
