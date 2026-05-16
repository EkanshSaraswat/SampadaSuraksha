import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function NGODashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="dashboard-layout">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="icon">🛡️</span> SampadaSuraksha
        </div>
        <div className="navbar-meta">
          {user?.role === 'Admin' && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/dashboard')} style={{ marginRight: '1rem' }}>
              Back to Admin
            </button>
          )}
          <span className="navbar-user">
            Welcome, <strong>{user?.name}</strong>
          </span>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      <div className="dashboard-body">
        <div className="dashboard-header">
          <h1>🏢 NGO Dashboard</h1>
        </div>

        <div className="placeholder-card">
          <div className="placeholder-icon">🏗️</div>
          <h2>NGO Dashboard — Coming Soon</h2>
          <p style={{ marginTop: '0.75rem', color: 'var(--color-text-muted)' }}>
            This section is under development. Logged in as <strong>{user?.name}</strong>.
          </p>
        </div>
      </div>
    </div>
  )
}
