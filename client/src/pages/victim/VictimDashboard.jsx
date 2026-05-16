import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'

const API = 'http://localhost:5000/api'

export default function VictimDashboard() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [reports, setReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [form, setForm] = useState({
    description: '',
    urgency: 'Normal',
    latitude: '',
    longitude: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const authHeader = { headers: { Authorization: `Bearer ${token}` } }

  const fetchReports = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/reports`, authHeader)
      // Filter to only this victim's reports if the API returns all
      const myReports = Array.isArray(data)
        ? data.filter(r => r.userId === user.id || r.user === user.id)
        : Array.isArray(data.reports)
          ? data.reports.filter(r => r.userId === user.id || r.user === user.id)
          : []
      setReports(myReports)
    } catch {
      // If the endpoint returns user-specific reports already, just use them
      try {
        const { data } = await axios.get(`${API}/reports/my`, authHeader)
        setReports(Array.isArray(data) ? data : data.reports || [])
      } catch {
        setReports([])
      }
    } finally {
      setLoadingReports(false)
    }
  }, [token, user.id])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      await axios.post(
        `${API}/reports`,
        {
          description: form.description.trim(),
          urgency: form.urgency,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
        },
        authHeader
      )
      setSuccess('Report submitted successfully!')
      setForm({ description: '', urgency: 'Normal', latitude: '', longitude: '' })
      fetchReports()
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to submit report.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

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

  function getUrgencyBadge(urgency) {
    if (urgency === 'Medical Emergency') return 'badge badge-emergency'
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
          <h1>🆘 Victim Dashboard</h1>
          <p>Report disasters and track the status of your requests for help.</p>
        </div>

        {/* Submit Report Form */}
        <div className="section-box">
          <h2>📝 Submit a New Report</h2>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="report-desc">Description</label>
              <textarea
                id="report-desc"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe the situation and what help you need…"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="report-urgency">Urgency Level</label>
              <select
                id="report-urgency"
                name="urgency"
                value={form.urgency}
                onChange={handleChange}
              >
                <option value="Normal">Normal</option>
                <option value="Medical Emergency">Medical Emergency</option>
              </select>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label htmlFor="report-lat">Latitude</label>
                <input
                  id="report-lat"
                  type="number"
                  step="any"
                  name="latitude"
                  value={form.latitude}
                  onChange={handleChange}
                  placeholder="e.g. 28.6139"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="report-lng">Longitude</label>
                <input
                  id="report-lng"
                  type="number"
                  step="any"
                  name="longitude"
                  value={form.longitude}
                  onChange={handleChange}
                  placeholder="e.g. 77.2090"
                  required
                />
              </div>
            </div>

            <button
              id="submit-report-btn"
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? <span className="spinner" /> : '🚨 Submit Report'}
            </button>
          </form>
        </div>

        {/* My Reports */}
        <div className="section-box">
          <h2>📋 My Previous Reports</h2>

          {loadingReports ? (
            <div className="empty-state">
              <span className="spinner" style={{ borderColor: 'var(--color-text-muted)', borderTopColor: 'var(--color-primary)' }} />
            </div>
          ) : reports.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>No reports submitted yet.</p>
            </div>
          ) : (
            reports.map(report => (
              <div className="report-card" key={report._id || report.id}>
                <div className="report-card-info">
                  <div className="report-card-desc">{report.description}</div>
                  <div className="report-card-meta">
                    <span className={getUrgencyBadge(report.urgency)}>{report.urgency}</span>
                    <span className={getStatusBadge(report.status)}>{report.status || 'Pending'}</span>
                    <span>📍 {report.latitude}, {report.longitude}</span>
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
