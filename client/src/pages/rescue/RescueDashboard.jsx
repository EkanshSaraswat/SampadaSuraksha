import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'
import {
  API,
  authHeaders,
  useLiveRefresh,
  mapsLink,
  getBriefingForTeam,
  getResourceCategoryIcon,
  NEED_OPTIONS,
} from '../../api'

export default function RescueDashboard() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [reports, setReports] = useState([])
  const [priorityReports, setPriorityReports] = useState([])
  const [allocations, setAllocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('missions')
  const [updatingId, setUpdatingId] = useState(null)
  const [updatingAllocId, setUpdatingAllocId] = useState(null)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [lastUpdated, setLastUpdated] = useState(null)

  const headers = useMemo(() => authHeaders(token), [token])
  const myId = user?.id || user?._id
  const teamProfile = profile || user
  const roster = teamProfile?.teamMembers || []

  const fetchAll = useCallback(async () => {
    try {
      const [meRes, reportsRes, allocRes, priorityRes] = await Promise.all([
        axios.get(`${API}/auth/me`, headers),
        axios.get(`${API}/reports/pending`, headers),
        axios.get(`${API}/resources/allocations/received`, headers),
        axios.get(`${API}/reports/priority`, headers),
      ])
      setProfile(meRes.data.user || null)
      setReports(reportsRes.data.reports || [])
      setAllocations(allocRes.data.allocations || [])
      setPriorityReports(priorityRes.data.reports || priorityRes.data.data || [])
      setLastUpdated(new Date())
    } catch {
      setReports([])
      setAllocations([])
    } finally {
      setLoading(false)
    }
  }, [token, headers])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useLiveRefresh(fetchAll, [fetchAll])

  function isAssignedToMe(report, teamId) {
    if (!teamId) return false
    const id = teamId.toString()
    const onTeam = (report.assignedTeams || []).some(t => (t._id || t).toString() === id)
    const claimed = (report.claimedBy?._id || report.claimedBy)?.toString() === id
    return onTeam || claimed
  }

  const myMissions = useMemo(
    () => reports.filter(r => isAssignedToMe(r, myId)),
    [reports, myId]
  )

  const activeMissions = useMemo(
    () => myMissions.filter(r => (r.status || '').toLowerCase() !== 'resolved'),
    [myMissions]
  )

  const stats = useMemo(() => {
    const inProgress = myMissions.filter(r =>
      ['claimed', 'in-progress', 'in_progress'].includes((r.status || '').toLowerCase())
    ).length
    const resolved = myMissions.filter(r => (r.status || '').toLowerCase() === 'resolved').length
    const pendingSupplies = allocations.filter(a => a.status === 'allocated').length
    return {
      active: activeMissions.length,
      inProgress,
      resolved,
      pendingSupplies,
    }
  }, [myMissions, activeMissions, allocations])

  async function handleProgress(reportId, status) {
    setMessage({ type: '', text: '' })
    setUpdatingId(reportId)
    try {
      await axios.patch(`${API}/reports/${reportId}/progress`, { status }, headers)
      setMessage({
        type: 'success',
        text: status === 'resolved' ? 'Mission completed. Stay safe.' : 'Mission marked in progress.',
      })
      fetchAll()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update status.',
      })
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleClaim(reportId) {
    setMessage({ type: '', text: '' })
    setUpdatingId(reportId)
    try {
      await axios.patch(`${API}/reports/${reportId}/claim`, {}, headers)
      setMessage({ type: 'success', text: 'Report claimed successfully!' })
      setActiveTab('missions')
      fetchAll()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to claim report.',
      })
    } finally {
      setUpdatingId(null)
    }
  }

  async function markSupplyReceived(allocId) {
    setUpdatingAllocId(allocId)
    setMessage({ type: '', text: '' })
    try {
      await axios.patch(`${API}/resources/allocations/${allocId}`, { status: 'delivered' }, headers)
      setMessage({ type: 'success', text: 'Supply marked as received.' })
      fetchAll()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to confirm receipt.',
      })
    } finally {
      setUpdatingAllocId(null)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  function getUrgencyBadge(urgency) {
    if (urgency === 'Medical Emergency') return 'badge badge-emergency'
    return 'badge badge-normal'
  }

  function getStatusBadge(status) {
    const s = (status || 'pending').toLowerCase()
    if (s === 'resolved') return 'badge badge-resolved'
    if (s === 'in-progress' || s === 'in_progress' || s === 'claimed') return 'badge badge-claimed'
    return 'badge badge-pending'
  }

  const tabStyle = tab => ({
    padding: '0.6rem 1.2rem',
    border: 'none',
    background: activeTab === tab ? 'var(--color-primary)' : 'var(--color-surface-2)',
    color: activeTab === tab ? '#fff' : 'var(--color-text-muted)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
  })

  return (
    <div className="dashboard-layout">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="icon">🛡️</span> SampadaSuraksha
        </div>
        <div className="navbar-meta">
          {lastUpdated && (
            <span className="live-badge">● Live · {lastUpdated.toLocaleTimeString()}</span>
          )}
          <span className="navbar-user">
            🚒 <strong>{teamProfile?.name || user?.name}</strong>
          </span>
          <button type="button" className="btn btn-danger btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      <div className="dashboard-body" style={{ maxWidth: '1000px' }}>
        <div className="dashboard-header">
          <h1>🚒 Rescue Operations</h1>
          <p>
            Missions from your NGO, provider supplies, and field briefings — everything in one place.
          </p>
        </div>

        {message.text && <div className={`alert alert-${message.type}`}>{message.text}</div>}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.75rem',
            marginBottom: '1.25rem',
          }}
        >
          {[
            { label: 'Active missions', value: stats.active, color: 'var(--color-warning)' },
            { label: 'In progress', value: stats.inProgress, color: 'var(--color-info)' },
            { label: 'Completed', value: stats.resolved, color: 'var(--color-success)' },
            { label: 'Supplies to collect', value: stats.pendingSupplies, color: 'var(--color-primary)' },
          ].map(s => (
            <div key={s.label} className="section-box" style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button type="button" style={tabStyle('missions')} onClick={() => setActiveTab('missions')}>
            📋 My Missions ({activeMissions.length})
          </button>
          <button type="button" style={tabStyle('priority')} onClick={() => setActiveTab('priority')}>
            🚨 Priority Queue ({priorityReports.length})
          </button>
          <button type="button" style={tabStyle('supplies')} onClick={() => setActiveTab('supplies')}>
            📦 Supplies ({allocations.length})
          </button>
          <button type="button" style={tabStyle('team')} onClick={() => setActiveTab('team')}>
            👥 My team ({roster.length || '—'})
          </button>
        </div>

        {loading ? (
          <div className="empty-state">
            <span className="spinner" />
          </div>
        ) : (
          <>
            {activeTab === 'missions' && (
              <div className="section-box">
                <h2>📋 Your missions</h2>
                {activeMissions.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">✅</div>
                    <p>No active missions. Your NGO will dispatch you when a task is ready.</p>
                  </div>
                ) : (
                  activeMissions.map(report => {
                    const id = report._id || report.id
                    const status = (report.status || 'pending').toLowerCase()
                    const briefing = getBriefingForTeam(report, myId)

                    return (
                      <div
                        key={id}
                        className="report-card"
                        style={{ flexDirection: 'column', alignItems: 'stretch' }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div className="report-card-desc">{report.description}</div>
                            <div className="report-card-meta">
                              <span className="badge badge-claimed">{report.disasterType || 'Other'}</span>
                              <span className={getUrgencyBadge(report.urgency)}>{report.urgency}</span>
                              <span className={getStatusBadge(status)}>{status}</span>
                              {mapsLink(report.latitude, report.longitude) && (
                                <a
                                  href={mapsLink(report.latitude, report.longitude)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-link"
                                >
                                  📍 Open map
                                </a>
                              )}
                              {report.victim?.name && <span>🆘 {report.victim.name}</span>}
                              {report.assignedNGO?.name && <span>🏢 {report.assignedNGO.name}</span>}
                            </div>
                            {report.needs?.length > 0 && (
                              <div
                                style={{
                                  marginTop: '0.5rem',
                                  display: 'flex',
                                  gap: '0.35rem',
                                  flexWrap: 'wrap',
                                }}
                              >
                                {report.needs.map(need => (
                                  <span key={need} className="badge" style={{ fontSize: '0.75rem' }}>
                                    {NEED_OPTIONS.find(n => n.value === need)?.label || need}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={updatingId === id || status === 'in-progress'}
                              onClick={() => handleProgress(id, 'in-progress')}
                            >
                              ▶ Start mission
                            </button>
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              disabled={updatingId === id}
                              onClick={() => handleProgress(id, 'resolved')}
                            >
                              ✓ Mark resolved
                            </button>
                          </div>
                        </div>

                        {briefing && (
                          <div
                            style={{
                              marginTop: '1rem',
                              padding: '1rem',
                              background: 'var(--color-surface-2)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid rgba(34, 197, 94, 0.35)',
                            }}
                          >
                            <strong style={{ color: 'var(--color-success)', fontSize: '0.9rem' }}>
                              📋 NGO field briefing
                            </strong>
                            {briefing.instructions && (
                              <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>{briefing.instructions}</p>
                            )}
                            {briefing.resources?.length > 0 && (
                              <>
                                <p
                                  style={{
                                    fontSize: '0.8rem',
                                    color: 'var(--color-text-muted)',
                                    margin: '0.5rem 0 0.35rem',
                                  }}
                                >
                                  Bring these resources:
                                </p>
                                <ul style={{ margin: '0 0 0 1.1rem', fontSize: '0.9rem', lineHeight: 1.7 }}>
                                  {briefing.resources.map((r, i) => (
                                    <li key={i}>
                                      <strong>{r.quantity}×</strong> {r.name} ({r.category})
                                      {r.sourceLabel && (
                                        <span style={{ color: 'var(--color-text-muted)' }}>
                                          {' '}
                                          — {r.sourceLabel}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}

                {myMissions.filter(r => (r.status || '').toLowerCase() === 'resolved').length > 0 && (
                  <div style={{ marginTop: '2rem' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--color-text-muted)' }}>
                      Recently completed
                    </h3>
                    {myMissions
                      .filter(r => (r.status || '').toLowerCase() === 'resolved')
                      .slice(0, 5)
                      .map(report => (
                        <div key={report._id} className="report-card" style={{ opacity: 0.85 }}>
                          <div className="report-card-desc">{report.description}</div>
                          <span className="badge badge-resolved">resolved</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'priority' && (
              <div className="section-box">
                <h2>🚨 Top Priority Rescues (Redis Queue)</h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Real-time feed of the most critical unassigned emergencies. You can claim these directly.
                </p>
                {priorityReports.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">✅</div>
                    <p>No unassigned priority reports in the queue.</p>
                  </div>
                ) : (
                  priorityReports.map(report => {
                    const id = report._id || report.id
                    return (
                      <div key={id} className="report-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1 }}>
                            <div className="report-card-desc">{report.description || report.needs}</div>
                            <div className="report-card-meta">
                              <span className="badge badge-claimed">{report.disasterType || 'Other'}</span>
                              <span className={getUrgencyBadge(report.urgency || report.category)}>{report.urgency || report.category}</span>
                              {mapsLink(report.latitude, report.longitude) && (
                                <a href={mapsLink(report.latitude, report.longitude)} target="_blank" rel="noreferrer" className="text-link">📍 Open map</a>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={updatingId === id}
                              onClick={() => handleClaim(id)}
                            >
                              🚨 Claim Mission
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {activeTab === 'supplies' && (
              <div className="section-box">
                <h2>📦 Supplies from providers</h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Stock allocated to your team by resource providers. Confirm when you have collected items.
                </p>
                {allocations.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📦</div>
                    <p>No provider allocations yet.</p>
                  </div>
                ) : (
                  allocations.map(alloc => {
                    const aid = alloc._id || alloc.id
                    return (
                      <div key={aid} className="report-card" style={{ flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <div className="report-card-desc">
                              {getResourceCategoryIcon(alloc.resource?.category)}{' '}
                              {alloc.quantity}× {alloc.resource?.name}
                            </div>
                            <div className="report-card-meta">
                              <span className={getStatusBadge(alloc.status === 'delivered' ? 'resolved' : 'claimed')}>
                                {alloc.status}
                              </span>
                              <span>From: {alloc.allocatedBy?.name || 'Provider'}</span>
                              <span>{new Date(alloc.createdAt).toLocaleDateString()}</span>
                            </div>
                            {alloc.notes && (
                              <p style={{ fontSize: '0.85rem', marginTop: '0.35rem', color: 'var(--color-text-muted)' }}>
                                📝 {alloc.notes}
                              </p>
                            )}
                          </div>
                          {alloc.status === 'allocated' && (
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              style={{ width: 'auto', alignSelf: 'flex-start' }}
                              disabled={updatingAllocId === aid}
                              onClick={() => markSupplyReceived(aid)}
                            >
                              {updatingAllocId === aid ? (
                                <span className="spinner" />
                              ) : (
                                '✓ Confirm received'
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {activeTab === 'team' && (
              <div className="section-box">
                <h2>👥 {teamProfile?.name || 'Your team'}</h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Team roster registered by your NGO. Login email: <strong>{teamProfile?.email}</strong>
                </p>
                {roster.length === 0 ? (
                  <div className="empty-state">
                    <p>Member list not available. Contact your coordinating NGO.</p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                      gap: '0.75rem',
                    }}
                  >
                    {roster.map((m, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '1rem',
                          background: 'var(--color-surface-2)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <strong>{m.name}</strong>
                        <div style={{ fontSize: '0.85rem', marginTop: '0.35rem', color: 'var(--color-text-muted)' }}>
                          📞 {m.contact}
                          {m.email && (
                            <>
                              <br />✉️ {m.email}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .dashboard-body > div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  )
}
