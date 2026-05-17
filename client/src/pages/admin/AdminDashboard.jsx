import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'

const API = 'http://localhost:5000/api'

export default function AdminDashboard() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  const authHeader = { headers: { Authorization: `Bearer ${token}` } }

  const fetchAllReports = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/reports`, authHeader)
      const all = data?.data || data?.reports || (Array.isArray(data) ? data : [])
      setReports(all)
    } catch {
      setReports([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchAllReports()
  }, [fetchAllReports])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  function getStatusBadge(status) {
    const s = (status || 'pending').toLowerCase()
    if (s === 'claimed' || s === 'in-progress' || s === 'in_progress') return 'badge badge-claimed'
    if (s === 'resolved' || s === 'completed') return 'badge badge-resolved'
    return 'badge badge-pending'
  }

  function getUrgencyBadge(category) {
    switch (category) {
      case 'medical': return 'badge badge-emergency'
      case 'trapped': return 'badge badge-emergency'
      case 'shelter': return 'badge badge-warning'
      case 'food_water': return 'badge badge-warning'
      default: return 'badge badge-normal'
    }
  }

  function formatCategory(category) {
    const map = {
      'medical': 'Medical Emergency',
      'trapped': 'Trapped',
      'shelter': 'Need Shelter',
      'food_water': 'Food & Water',
      'other': 'Other'
    };
    return map[category] || 'Other';
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

        {/* Global Reports Feed */}
        <div className="section-box" style={{ marginTop: '2rem' }}>
          <h2>🌐 Global Reports Feed</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Live view of all system reports across the platform.
          </p>

          {loading ? (
            <div className="empty-state">
              <span className="spinner" style={{ borderColor: 'var(--color-text-muted)', borderTopColor: 'var(--color-primary)' }} />
            </div>
          ) : reports.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>No reports in the system.</p>
            </div>
          ) : (
            reports.map(report => (
              <div className="report-card" key={report._id || report.id} style={{ marginBottom: '1rem' }}>
                <div className="report-card-info">
                  <div className="report-card-desc">{report.needs}</div>
                  <div className="report-card-meta">
                    <span className={getUrgencyBadge(report.category)}>{formatCategory(report.category)}</span>
                    <span className={getStatusBadge(report.status)}>{report.status || 'Pending'}</span>
                    <span>📍 {report.location?.coordinates?.[1]}, {report.location?.coordinates?.[0]}</span>
                    {report.assignedTeam && (
                      <span className="badge badge-normal" style={{ marginLeft: 'auto' }}>
                        Assigned: {report.assignedTeam._id || report.assignedTeam}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
