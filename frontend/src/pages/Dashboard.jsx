import React, { useState } from 'react'
import Header from '../components/Header.jsx'
import Sidebar from '../components/Sidebar.jsx'
import Home from '../subs/Home.jsx'
import UserList from '../subs/UserList.jsx'
import DivisionList from '../subs/DivisionList.jsx'
import { useAuthStore } from '../stores/useAuthStore' 
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user)
  const permissions = user?.role_id?.permissions || []
  
  const [activePage, setActivePage] = useState('')

  const renderPage = () => {
    if (activePage === 'UserList') {
      return <UserList />
    }
    if (activePage === 'DivisionList') {
      return <DivisionList />
    }
    return <Home />
  }

  // Optional: kalau user belum login atau token habis, redirect ke login
  // (tambahkan ini kalau mau lebih aman)
  if (!user) {
    window.location.href = '/'
    return null
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar 
        isOpen={isSidebarOpen}
        closeSidebar={() => setIsSidebarOpen(false)}
        permissions={permissions}        // ini sekarang real-time dari Zustand
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onNavigateToProfile={(userId) => navigate(`/profile/${userId}`)}
        />

        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}