import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function AdminDashboard() {
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
          <span className="navbar-user">
            Welcome, <strong>{user?.name} (Admin)</strong>
          </span>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      <div className="dashboard-body">
        <div className="dashboard-header">
          <h1>⚙️ Admin Dashboard</h1>
          <p>System Overview and Management</p>
        </div>

        <div className="section-box">
          <h2>📊 Quick Navigation</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            As an Admin, you have access to view all other portals.
          </p>
          <div className="grid-2">
            <Link to="/victim/dashboard" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: '1.5rem', display: 'block', transition: 'border-color 0.2s' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>🆘 Victim Dashboard</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>View the victim reporting interface.</p>
            </Link>
            
            <Link to="/rescue/dashboard" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: '1.5rem', display: 'block', transition: 'border-color 0.2s' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>🚒 Rescue Dashboard</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>View the rescue team mission control.</p>
            </Link>
            
            <Link to="/ngo/dashboard" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: '1.5rem', display: 'block', transition: 'border-color 0.2s' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>🏢 NGO Dashboard</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>View the NGO coordination portal.</p>
            </Link>
            
            <Link to="/resource/dashboard" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: '1.5rem', display: 'block', transition: 'border-color 0.2s' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>📦 Resource Dashboard</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>View the resource provider portal.</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
