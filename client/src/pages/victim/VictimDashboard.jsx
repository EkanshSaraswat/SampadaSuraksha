import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'
import { API, authHeaders, useLiveRefresh, mapsLink, NEED_OPTIONS, DISASTER_TYPES } from '../../api'

const EMPTY_FORM = {
  description: '',
  disasterType: 'Other',
  urgency: 'Normal',
  latitude: null,
  longitude: null,
  needs: [],
}

export default function VictimDashboard() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [reports, setReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [locationStatus, setLocationStatus] = useState('loading')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  const headers = useMemo(() => authHeaders(token), [token])

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported')
      return
    }
    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(prev => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }))
        setLocationStatus('ready')
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  }, [])

  useEffect(() => {
    detectLocation()
  }, [detectLocation])

  const fetchReports = useCallback(async () => {
    if (!token) return
    try {
      const { data } = await axios.get(`${API}/reports/mine`, headers)
      setReports(data.reports || [])
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to load reports:', err.response?.data || err.message)
    } finally {
      setLoadingReports(false)
    }
  }, [token, headers])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  useLiveRefresh(fetchReports, [fetchReports])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function toggleNeed(need) {
    setForm(prev => ({
      ...prev,
      needs: prev.needs.includes(need)
        ? prev.needs.filter(n => n !== need)
        : [...prev.needs, need],
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (form.latitude == null || form.longitude == null) {
      setError('Location is required. Allow location access or tap "Refresh location".')
      return
    }

    if (form.needs.length === 0) {
      setError('Please select at least one type of help you need.')
      return
    }

    setSubmitting(true)

    try {
      const { data } = await axios.post(
        `${API}/reports`,
        {
          description: form.description.trim(),
          urgency: form.urgency,
          latitude: form.latitude,
          longitude: form.longitude,
          needs: form.needs,
          disasterType: form.disasterType,
        },
        headers
      )

      const newReport = data.report
      if (newReport) {
        setReports(prev => {
          const id = newReport._id
          const exists = prev.some(r => r._id === id)
          return exists ? prev : [newReport, ...prev]
        })
      }

      setSuccess('Report submitted successfully! Rescue teams have been notified.')
      setForm({
        ...EMPTY_FORM,
        latitude: form.latitude,
        longitude: form.longitude,
      })
      await fetchReports()
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Failed to submit report.'
      )
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
    if (s === 'claimed' || s === 'in-progress') return 'badge badge-claimed'
    if (s === 'resolved') return 'badge badge-resolved'
    return 'badge badge-pending'
  }

  function getUrgencyBadge(urgency) {
    if (urgency === 'Medical Emergency') return 'badge badge-emergency'
    return 'badge badge-normal'
  }

  return (
    <div className="dashboard-layout">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="icon">🛡️</span> SampadaSuraksha
        </div>
        <div className="navbar-meta">
          {lastUpdated && (
            <span className="live-badge" title="Auto-refreshes every 10 seconds">
              ● Live · {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <span className="navbar-user">
            Welcome, <strong>{user?.name}</strong>
          </span>
          <button type="button" className="btn btn-danger btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      <div className="dashboard-body">
        <div className="dashboard-header">
          <h1>🆘 Victim Dashboard</h1>
          <p>Report disasters and track the status of your requests for help.</p>
        </div>

        <div className="section-box">
          <h2>📝 Submit a New Report</h2>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <LocationPanel
            status={locationStatus}
            lat={form.latitude}
            lng={form.longitude}
            onRefresh={detectLocation}
          />

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
              <label>What do you need? <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(select all that apply)</span></label>
              <div className="needs-grid">
                {NEED_OPTIONS.map(({ value, label, icon }) => {
                  const selected = form.needs.includes(value)
                  return (
                    <button
                      key={value}
                      type="button"
                      className={`need-chip${selected ? ' need-chip--selected' : ''}`}
                      onClick={() => toggleNeed(value)}
                      aria-pressed={selected}
                    >
                      <span>{icon}</span> {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="report-disaster">Disaster Type</label>
              <select
                id="report-disaster"
                name="disasterType"
                value={form.disasterType}
                onChange={handleChange}
              >
                {DISASTER_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
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

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || locationStatus !== 'ready'}
            >
              {submitting ? <span className="spinner" /> : '🚨 Submit Report'}
            </button>
          </form>
        </div>

        <div className="section-box">
          <h2>📋 My Reports ({reports.length})</h2>
          {loadingReports ? (
            <EmptyState loading />
          ) : reports.length === 0 ? (
            <EmptyState icon="📭" text="No reports submitted yet." />
          ) : (
            reports.map(report => {
              const link = mapsLink(report.latitude, report.longitude)
              return (
                <div className="report-card" key={report._id || report.id}>
                  <div className="report-card-info">
                    <div className="report-card-desc">{report.description}</div>
                    {report.needs?.length > 0 && (
                      <div className="needs-tags">
                        {report.needs.map(need => {
                          const opt = NEED_OPTIONS.find(o => o.value === need)
                          return (
                            <span key={need} className="badge badge-claimed">
                              {opt?.icon || '📦'} {need}
                            </span>
                          )
                        })}
                      </div>
                    )}
                    <div className="report-card-meta">
                      <span className="badge badge-claimed">{report.disasterType || 'Other'}</span>
                      <span className={getUrgencyBadge(report.urgency)}>{report.urgency}</span>
                      <span className={getStatusBadge(report.status)}>
                        {report.status || 'pending'}
                      </span>
                      {link && (
                        <a href={link} target="_blank" rel="noreferrer" className="text-link">
                          📍 Open location
                        </a>
                      )}
                      {report.claimedBy?.name && (
                        <span style={{ color: 'var(--color-info)' }}>
                          👷 {report.claimedBy.name}
                        </span>
                      )}
                      {report.createdAt && (
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          🕐 {new Date(report.createdAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}


function LocationPanel({ status, lat, lng, onRefresh }) {
  return (
    <div
      className="location-panel"
      style={{
        marginBottom: '1rem',
        padding: '1rem',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <strong>📍 Your location</strong>
          {status === 'loading' && (
            <p style={{ margin: '0.35rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Detecting GPS location…
            </p>
          )}
          {status === 'ready' && (
            <p style={{ margin: '0.35rem 0 0', color: 'var(--color-success)', fontSize: '0.9rem' }}>
              {lat}, {lng}{' '}
              <a href={mapsLink(lat, lng)} target="_blank" rel="noreferrer" className="text-link">
                View on map
              </a>
            </p>
          )}
          {status === 'denied' && (
            <p style={{ margin: '0.35rem 0 0', color: 'var(--color-danger)', fontSize: '0.9rem' }}>
              Location blocked. Enable it in browser settings, then refresh.
            </p>
          )}
          {status === 'unsupported' && (
            <p style={{ margin: '0.35rem 0 0', color: 'var(--color-danger)', fontSize: '0.9rem' }}>
              Geolocation is not supported in this browser.
            </p>
          )}
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={onRefresh} style={{ width: 'auto' }}>
          🔄 Refresh location
        </button>
      </div>
    </div>
  )
}

function EmptyState({ loading, icon, text }) {
  if (loading) {
    return (
      <div className="empty-state">
        <span
          className="spinner"
          style={{
            borderColor: 'var(--color-text-muted)',
            borderTopColor: 'var(--color-primary)',
          }}
        />
      </div>
    )
  }
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <p>{text}</p>
    </div>
  )
}
