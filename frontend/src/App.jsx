import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import PublicIDCard from './pages/PublicIDCard';
import { useAuthStore } from './stores/useAuthStore';
import { useEffect, useState } from 'react';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  
  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

// Public Route Component (redirect ke dashboard jika sudah login)
const PublicRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  
  if (isAuthenticated && user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function App() {
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  useEffect(() => {
    const fetchMe = async () => {
      // HANYA fetch jika user sudah ada di store (dari persist)
      // atau belum pernah check
      const storedUser = useAuthStore.getState().user;
      
      // Skip fetch jika user null (baru logout)
      if (!storedUser) {
        setLoading(false);
        return;
      }

      try {
        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
        });
      
        if (res.ok) {
          const data = await res.json();
          useAuthStore.getState().setUser(data.user);
        } else {
          // Cookie invalid/expired, clear state
          useAuthStore.getState().logout();
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        useAuthStore.getState().logout();
      } finally {
        setLoading(false);
      }
    };
    
    fetchMe();
  }, []); // Hanya run sekali saat mount

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route 
          path="/" 
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } 
        />
        <Route 
          path="/register" 
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          } 
        />
        <Route 
          path="/id/:code" 
          element={<PublicIDCard />} 
        />
        
        {/* Protected Routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile/:userId" 
          element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/account-request" 
          element={
            <ProtectedRoute>
              <AccountRequestForm />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/account-setup" 
          element={
            <ProtectedRoute>
              <AccountSetup />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/approvals" 
          element={
            <ProtectedRoute>
              <ApprovalInbox />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/approvals/:id" 
          element={
            <ProtectedRoute>
              <ApprovalDetail />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/documents/user/:id" 
          element={
            <ProtectedRoute>
              <DocumentViewer />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/pending-users" 
          element={
            <ProtectedRoute>
              <PendingUsers />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App