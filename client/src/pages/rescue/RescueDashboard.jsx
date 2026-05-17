import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'

const API = 'http://localhost:5000/api'

export default function RescueDashboard() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState(null)
  const [message, setMessage] = useState({ type: '', text: '' })

  const authHeader = { headers: { Authorization: `Bearer ${token}` } }

  const fetchReports = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/reports/priority`, authHeader)
      const all = data?.data || data?.reports || (Array.isArray(data) ? data : [])
      setReports(all)
    } catch {
      setReports([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  async function handleClaim(reportId) {
    setMessage({ type: '', text: '' })
    setClaimingId(reportId)

    // Optimistic update — remove from list
    const prev = [...reports]
    setReports(r => r.filter(rep => (rep._id || rep.id) !== reportId))

    try {
      await axios.patch(`${API}/reports/${reportId}/claim`, {}, authHeader)
      setMessage({ type: 'success', text: 'Report claimed successfully!' })
    } catch (err) {
      // Rollback
      setReports(prev)
      if (err.response?.status === 409) {
        setMessage({ type: 'error', text: 'Already claimed by another team.' })
      } else {
        const msg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          'Failed to claim report.'
        setMessage({ type: 'error', text: msg })
      }
    } finally {
      setClaimingId(null)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  function getUrgencyBadge(isEmergency) {
    if (isEmergency) return 'badge badge-emergency'
    return 'badge badge-normal'
  }

  return (
    <div className="dashboard-layout">
      {/* Navbar */}
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

      {/* Body */}
      <div className="dashboard-body">
        <div className="dashboard-header">
          <h1>🚒 Rescue Team Dashboard</h1>
          <p>View and claim unassigned disaster reports to coordinate relief.</p>
        </div>

        {message.text && (
          <div className={`alert alert-${message.type}`}>{message.text}</div>
        )}

        <div className="section-box">
          <h2>📋 Available Reports</h2>

          {loading ? (
            <div className="empty-state">
              <span className="spinner" style={{ borderColor: 'var(--color-text-muted)', borderTopColor: 'var(--color-primary)' }} />
            </div>
          ) : reports.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <p>No unassigned reports at this time.</p>
            </div>
          ) : (
            reports.map(report => {
              const id = report._id || report.id
              return (
                <div className="report-card" key={id}>
                  <div className="report-card-info">
                    <div className="report-card-desc">{report.needs}</div>
                    <div className="report-card-meta">
                      <span className={getUrgencyBadge(report.medicalEmergency)}>{report.medicalEmergency ? 'Medical Emergency' : 'Normal'}</span>
                      <span>📍 {report.location?.coordinates?.[1]}, {report.location?.coordinates?.[0]}</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleClaim(id)}
                    disabled={claimingId === id}
                  >
                    {claimingId === id ? <span className="spinner" /> : '🤝 Claim'}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
