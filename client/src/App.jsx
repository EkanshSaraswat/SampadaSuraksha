import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/Login'
import Register from './pages/Register'
import Unauthorized from './pages/Unauthorized'

import VictimDashboard from './pages/victim/VictimDashboard'
import RescueDashboard from './pages/rescue/RescueDashboard'
import NGODashboard from './pages/ngo/NGODashboard'
import AdminDashboard from './pages/admin/AdminDashboard'
import ResourceDashboard from './pages/resource/ResourceDashboard'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected routes */}
          <Route
            path="/victim/dashboard"
            element={
              <ProtectedRoute allowedRoles={['Victim', 'Admin']}>
                <VictimDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rescue/dashboard"
            element={
              <ProtectedRoute allowedRoles={['RescueTeam', 'Admin']}>
                <RescueDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ngo/dashboard"
            element={
              <ProtectedRoute allowedRoles={['NGO', 'Admin']}>
                <NGODashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource/dashboard"
            element={
              <ProtectedRoute allowedRoles={['ResourceProvider', 'Admin']}>
                <ResourceDashboard />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
