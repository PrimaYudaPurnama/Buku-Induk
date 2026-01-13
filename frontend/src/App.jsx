import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import UserProfile from './pages/Profile';
import AccountRequestForm from './pages/AccountRequestForm';
import AccountSetup from './pages/AccountSetup';
import ApprovalInbox from './pages/ApprovalInbox';
import ApprovalDetail from './pages/ApprovalDetail';
import DocumentViewer from './pages/DocumentViewer';
import NotificationCenter from './pages/NotificationCenter';
import PendingUsers from './pages/PendingUsers';
import { useAuthStore } from './stores/useAuthStore';
import { useEffect } from 'react';


function App() {
  
  useEffect(() => {
  const fetchMe = async () => {
    const res = await fetch('http://localhost:3000/api/v1/auth/me', {
      credentials: 'include',
    });
  
    if (res.ok) {
      const data = await res.json();
      useAuthStore.getState().setUser(data.user);
    } else {
      useAuthStore.getState().logout();
    }
  };
  fetchMe();
  }, []);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile/:userId" element={<UserProfile />} />
        <Route path="/account-request" element={<AccountRequestForm />} />
        <Route path="/account-setup" element={<AccountSetup />} />
        <Route path="/approvals" element={<ApprovalInbox />} />
        <Route path="/approvals/:id" element={<ApprovalDetail />} />
        <Route path="/documents/user/:id" element={<DocumentViewer />} />
        {/* <Route path="/notifications" element={<NotificationCenter />} /> */}
        <Route path="/pending-users" element={<PendingUsers />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
