import React, { useEffect, useState } from 'react'
import Header from '../components/Header.jsx'
import Sidebar from '../components/Sidebar.jsx'
import Home from '../subs/Home.jsx'
import UserList from '../subs/UserList.jsx'
import DivisionList from '../subs/DivisionList.jsx'
import DocumentList from '../subs/DocumentList.jsx'
import AccountRequestForm from './AccountRequestForm.jsx'
import ApprovalInbox from './ApprovalInbox.jsx'
import NotificationCenter from './NotificationCenter.jsx'
import SalaryReport from './SalaryReport.jsx'
import AuditLogs from './AuditLogs.jsx'
import RoleManagement from './RoleManagement.jsx'
import WorkflowAnalytics from './WorkflowAnalytics.jsx'
import OrgChart from './OrgChart.jsx'
import { useAuthStore } from '../stores/useAuthStore' 
import { useNavigate } from 'react-router-dom';
import { fetchCurrentUser } from '../utils/api.jsx';

export default function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return window.innerWidth >= 1024; // desktop open, mobile closed
  });
  
  
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user)
  const permissions = user?.role_id?.permissions || []
  const setUser = useAuthStore((state) => state.setUser)
  
  const [activePage, setActivePage] = useState('Home')

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
  
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  

  // Keep user data fresh so new role/permission updates propagate without re-login
  useEffect(() => {
    const syncUser = async () => {
      try {
        const latestUser = await fetchCurrentUser();
        if (latestUser) {
          setUser(latestUser);
        }
      } catch (err) {
        console.error("Gagal sinkron user:", err);
      }
    };
    syncUser();
  }, [setUser]);

  const renderPage = () => {
    switch (activePage) {
      case 'Home':
        return <Home />
      case 'UserList':
        return <UserList />
      case 'DivisionList':
        return <DivisionList />
      case 'AccountRequest':
        return <AccountRequestForm />
      case 'ApprovalInbox':
        return <ApprovalInbox />
      case 'Notifications':
        return <NotificationCenter />
      case 'SalaryReport':
        return <SalaryReport />
      case 'Documents':
        return <DocumentList />
      case 'RoleSettings':
        return <RoleManagement />
      case 'AuditLogs':
        return <AuditLogs />
      case 'WorkflowAnalytics':
        return <WorkflowAnalytics />
      case 'OrgChart':
        return <OrgChart />
      default:
        return <Home />
    }
  }

  // Optional: kalau user belum login atau token habis, redirect ke login
  // (tambahkan ini kalau mau lebih aman)
  if (!user) {
    window.location.href = '/'
    return null
  }
  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <Sidebar 
        isOpen={isSidebarOpen}
        closeSidebar={() => setIsSidebarOpen(false)}
        permissions={permissions}        // ini sekarang real-time dari Zustand
        activePage={activePage}
        setActivePage={setActivePage}
      />

        <div
          className={`flex-1 flex flex-col overflow-hidden transition-all duration-300
            ${isSidebarOpen ? 'lg:ml-80' : 'ml-0'}
          `}
        >
        <Header 
          toggleSidebar={() => setIsSidebarOpen(prev => !prev)}
          onNavigateToProfile={(userId) => navigate(`/profile/${userId}`)}
        />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}