import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'
import {
  API,
  authHeaders,
  useLiveRefresh,
  mapsLink,
  fuzzyMatch,
  DISASTER_TYPES,
  USER_ROLES,
  REPORT_STATUSES,
  getTeamId,
  getNgoId,
  ngoLocationLabel,
  sortNgosForReport,
  distanceKm,
  isApprovedRescueTeam,
  isAvailableRescueTeam,
} from '../../api'

export default function AdminDashboard() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [users, setUsers] = useState([])
  const [reports, setReports] = useState([])
  const [resources, setResources] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingReports, setLoadingReports] = useState(true)
  const [loadingResources, setLoadingResources] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [deletingUserId, setDeletingUserId] = useState(null)
  const [deletingResourceId, setDeletingResourceId] = useState(null)
  const [updatingReportId, setUpdatingReportId] = useState(null)
  const [assigningReportId, setAssigningReportId] = useState(null)
  const [teams, setTeams] = useState([])
  const [ngos, setNgos] = useState([])
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [loadingNgos, setLoadingNgos] = useState(true)
  const [loadingApprovals, setLoadingApprovals] = useState(true)
  const [approvingId, setApprovingId] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [lastUpdated, setLastUpdated] = useState(null)

  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [reportSearch, setReportSearch] = useState('')
  const [reportStatusFilter, setReportStatusFilter] = useState('all')
  const [reportDisasterFilter, setReportDisasterFilter] = useState('all')
  const [reportNgoFilter, setReportNgoFilter] = useState('all')
  const [ngoLocationFilter, setNgoLocationFilter] = useState('')
  const [teamSearch, setTeamSearch] = useState('')
  const [ngoSearch, setNgoSearch] = useState('')

  const headers = useMemo(() => authHeaders(token), [token])

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/users`, headers)
      setUsers(data.users || [])
    } catch {
      setUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }, [token, headers])

  // Fetch reports
  const fetchReports = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/reports`, headers)
      setReports(data.reports || [])
    } catch {
      setReports([])
    } finally {
      setLoadingReports(false)
    }
  }, [token, headers])

  // Fetch resources
  const fetchResources = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/resources`, headers)
      setResources(data.resources || [])
    } catch {
      setResources([])
    } finally {
      setLoadingResources(false)
    }
  }, [token, headers])

  const fetchTeams = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/teams?includePending=true`, headers)
      setTeams(data.teams || [])
    } catch {
      setTeams([])
    } finally {
      setLoadingTeams(false)
    }
  }, [token, headers])

  const fetchNgos = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/ngos`, headers)
      setNgos(data.ngos || [])
    } catch {
      setNgos([])
    } finally {
      setLoadingNgos(false)
    }
  }, [token, headers])

  const fetchPendingApprovals = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/users/pending-approvals`, headers)
      setPendingApprovals(data.users || [])
    } catch {
      setPendingApprovals([])
    } finally {
      setLoadingApprovals(false)
    }
  }, [token, headers])

  const refreshAll = useCallback(() => {
    fetchUsers()
    fetchReports()
    fetchResources()
    fetchTeams()
    fetchNgos()
    fetchPendingApprovals()
    setLastUpdated(new Date())
  }, [fetchUsers, fetchReports, fetchResources, fetchTeams, fetchNgos, fetchPendingApprovals])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  useLiveRefresh(refreshAll, [refreshAll])

  async function handleDeleteUser(userId) {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return

    setMessage({ type: '', text: '' })
    setDeletingUserId(userId)

    try {
      await axios.delete(`${API}/users/${userId}`, headers)
      setMessage({ type: 'success', text: 'User deleted successfully.' })
      fetchUsers()
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to delete user.'
      setMessage({ type: 'error', text: msg })
    } finally {
      setDeletingUserId(null)
    }
  }

  async function handleReportStatus(reportId, status) {
    setMessage({ type: '', text: '' })
    setUpdatingReportId(reportId)
    try {
      await axios.patch(`${API}/reports/${reportId}/status`, { status }, headers)
      setMessage({ type: 'success', text: 'Report status updated.' })
      fetchReports()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update report.',
      })
    } finally {
      setUpdatingReportId(null)
    }
  }

  async function handleApproveTeam(userId) {
    setMessage({ type: '', text: '' })
    setApprovingId(userId)
    try {
      await axios.patch(`${API}/users/${userId}/approve`, {}, headers)
      setMessage({ type: 'success', text: 'Rescue team approved. They can now sign in.' })
      fetchPendingApprovals()
      fetchUsers()
      fetchTeams()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to approve.',
      })
    } finally {
      setApprovingId(null)
    }
  }

  async function handleRejectTeam(userId) {
    if (!window.confirm('Reject this rescue team registration?')) return
    setMessage({ type: '', text: '' })
    setApprovingId(userId)
    try {
      await axios.patch(`${API}/users/${userId}/reject`, {}, headers)
      setMessage({ type: 'success', text: 'Registration rejected.' })
      fetchPendingApprovals()
      fetchUsers()
      fetchTeams()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to reject.',
      })
    } finally {
      setApprovingId(null)
    }
  }

  async function handleAssignNgo(reportId, ngoId) {
    if (!ngoId) return
    setMessage({ type: '', text: '' })
    setAssigningReportId(reportId)
    try {
      await axios.patch(`${API}/reports/assign-ngo/${reportId}`, { ngoId }, headers)
      setMessage({ type: 'success', text: 'NGO assigned. They will dispatch rescue teams.' })
      fetchReports()
      fetchNgos()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to assign NGO.',
      })
    } finally {
      setAssigningReportId(null)
    }
  }

  async function handleUnassignNgo(reportId) {
    setMessage({ type: '', text: '' })
    setAssigningReportId(reportId)
    try {
      await axios.patch(`${API}/reports/unassign-ngo/${reportId}`, {}, headers)
      setMessage({ type: 'success', text: 'NGO removed from report.' })
      fetchReports()
      fetchNgos()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to unassign NGO.',
      })
    } finally {
      setAssigningReportId(null)
    }
  }

  async function handleDeleteResource(resourceId) {
    if (!window.confirm('Delete this resource from inventory?')) return
    setMessage({ type: '', text: '' })
    setDeletingResourceId(resourceId)
    try {
      await axios.delete(`${API}/resources/${resourceId}`, headers)
      setMessage({ type: 'success', text: 'Resource deleted.' })
      fetchResources()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to delete resource.',
      })
    } finally {
      setDeletingResourceId(null)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  function getStatusBadge(status) {
    const s = (status || 'pending').toLowerCase()
    if (s === 'claimed' || s === 'in-progress' || s === 'in_progress')
      return 'badge badge-claimed'
    if (s === 'resolved' || s === 'completed') return 'badge badge-resolved'
    return 'badge badge-pending'
  }

  function getRoleBadge(role) {
    const styles = {
      Admin: { background: 'rgba(239,68,68,0.15)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.35)' },
      Victim: { background: 'rgba(245,158,11,0.15)', color: 'var(--color-warning)', border: '1px solid rgba(245,158,11,0.35)' },
      RescueTeam: { background: 'rgba(59,130,246,0.15)', color: 'var(--color-info)', border: '1px solid rgba(59,130,246,0.35)' },
      NGO: { background: 'rgba(34,197,94,0.15)', color: 'var(--color-success)', border: '1px solid rgba(34,197,94,0.35)' },
      ResourceProvider: { background: 'rgba(232,93,4,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(232,93,4,0.35)' },
    }
    return styles[role] || styles.Victim
  }

  // Stats
  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1
    return acc
  }, {})
  const pendingReports = reports.filter(r => (r.status || 'pending') === 'pending').length
  const claimedReports = reports.filter(r => r.status === 'claimed' || r.status === 'in-progress').length
  const resolvedReports = reports.filter(r => r.status === 'resolved').length
  const totalResourceQty = resources.reduce(
    (sum, r) => sum + (r.quantity || 0),
    0
  )

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false
      const text = `${u.name} ${u.email} ${u.role}`
      return fuzzyMatch(userSearch, text)
    })
  }, [users, userSearch, userRoleFilter])

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (reportStatusFilter !== 'all' && (r.status || 'pending') !== reportStatusFilter) {
        return false
      }
      if (reportDisasterFilter !== 'all' && (r.disasterType || 'Other') !== reportDisasterFilter) {
        return false
      }
      if (reportNgoFilter !== 'all') {
        const ngoId = (r.assignedNGO?._id || r.assignedNGO)?.toString()
        if (ngoId !== reportNgoFilter) return false
      }
      const ngoName = r.assignedNGO?.name || ''
      const teamNames = (r.assignedTeams || []).map(t => t.name).join(' ')
      const text = `${r.description} ${r.victim?.name} ${r.victim?.email} ${r.disasterType} ${r.urgency} ${r.status} ${ngoName} ${teamNames}`
      return fuzzyMatch(reportSearch, text)
    })
  }, [reports, reportSearch, reportStatusFilter, reportDisasterFilter, reportNgoFilter])

  const filteredNgos = useMemo(() => {
    const q = ngoLocationFilter.trim().toLowerCase()
    return ngos.filter(n => {
      if (!fuzzyMatch(ngoSearch, `${n.name} ${n.email} ${n.city} ${n.state}`)) return false
      if (!q) return true
      const loc = `${n.city || ''} ${n.state || ''}`.toLowerCase()
      return loc.includes(q) || q.split(/\s+/).every(w => loc.includes(w))
    })
  }, [ngos, ngoSearch, ngoLocationFilter])

  const filteredTeams = useMemo(() => {
    return teams.filter(t => fuzzyMatch(teamSearch, `${t.name} ${t.email}`))
  }, [teams, teamSearch])

  const tabStyle = (tab) => ({
    padding: '0.6rem 1.2rem',
    border: 'none',
    background:
      activeTab === tab ? 'var(--color-primary)' : 'var(--color-surface-2)',
    color: activeTab === tab ? '#fff' : 'var(--color-text-muted)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.9rem',
    fontWeight: 600,
    transition: 'all 0.2s ease',
  })

  const tableHeaderStyle = {
    padding: '0.65rem 1rem',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--color-text-muted)',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
  }

  const tableCellStyle = {
    padding: '0.7rem 1rem',
    fontSize: '0.9rem',
    borderBottom: '1px solid var(--color-border)',
    verticalAlign: 'middle',
  }

  return (
    <div className="dashboard-layout">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="icon">🛡️</span> SampadaSuraksha
        </div>
        <div className="navbar-meta">
          {lastUpdated && (
            <span className="live-badge">● Live · {lastUpdated.toLocaleTimeString()}</span>
          )}
          <span className="navbar-user">
            Welcome, <strong>{user?.name} (Admin)</strong>
          </span>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      {/* Body */}
      <div className="dashboard-body" style={{ maxWidth: '1200px' }}>
        <div className="dashboard-header">
          <h1>⚙️ Admin Dashboard</h1>
          <p>
            Full system overview — manage users, monitor reports, and track
            resources.
          </p>
        </div>

        {message.text && (
          <div className={`alert alert-${message.type}`}>{message.text}</div>
        )}

        {/* Stats Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '0.8rem',
            marginBottom: '1.5rem',
          }}
        >
          <div
            className="section-box"
            style={{ textAlign: 'center', padding: '1rem' }}
          >
            <div
              style={{
                fontSize: '1.8rem',
                fontWeight: 800,
                color: 'var(--color-primary)',
              }}
            >
              {users.length}
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Total Users
            </div>
          </div>
          <div
            className="section-box"
            style={{ textAlign: 'center', padding: '1rem' }}
          >
            <div
              style={{
                fontSize: '1.8rem',
                fontWeight: 800,
                color: 'var(--color-warning)',
              }}
            >
              {reports.length}
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Total Reports
            </div>
          </div>
          <div
            className="section-box"
            style={{ textAlign: 'center', padding: '1rem' }}
          >
            <div
              style={{
                fontSize: '1.8rem',
                fontWeight: 800,
                color: 'var(--color-danger)',
              }}
            >
              {pendingReports}
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Pending Reports
            </div>
          </div>
          <div
            className="section-box"
            style={{ textAlign: 'center', padding: '1rem' }}
          >
            <div
              style={{
                fontSize: '1.8rem',
                fontWeight: 800,
                color: 'var(--color-accent)',
              }}
            >
              {resources.length}
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Resources
            </div>
          </div>
          <div
            className="section-box"
            style={{ textAlign: 'center', padding: '1rem' }}
          >
            <div
              style={{
                fontSize: '1.8rem',
                fontWeight: 800,
                color: 'var(--color-success)',
              }}
            >
              {totalResourceQty}
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Inventory Qty
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}
        >
          <button style={tabStyle('overview')} onClick={() => setActiveTab('overview')}>
            📊 Overview
          </button>
          <button style={tabStyle('users')} onClick={() => setActiveTab('users')}>
            👥 Users ({users.length})
          </button>
          <button style={tabStyle('reports')} onClick={() => setActiveTab('reports')}>
            📋 Reports ({filteredReports.length}/{reports.length})
          </button>
          <button style={tabStyle('approvals')} onClick={() => setActiveTab('approvals')}>
            ✅ Approvals ({pendingApprovals.length})
          </button>
          <button style={tabStyle('ngos')} onClick={() => setActiveTab('ngos')}>
            🏢 NGOs ({ngos.length})
          </button>
          <button style={tabStyle('teams')} onClick={() => setActiveTab('teams')}>
            🚒 Rescue Teams ({teams.length})
          </button>
          <button style={tabStyle('resources')} onClick={() => setActiveTab('resources')}>
            📦 Resources ({resources.length})
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            <div className="section-box">
              <h2>📈 Operations Summary</h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1rem',
                  marginTop: '1rem',
                }}
              >
                <div style={{ padding: '1rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-danger)' }}>{pendingReports}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Awaiting rescue</div>
                </div>
                <div style={{ padding: '1rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-info)' }}>{claimedReports}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Active missions</div>
                </div>
                <div style={{ padding: '1rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-success)' }}>{resolvedReports}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Resolved</div>
                </div>
              </div>
              <p style={{ marginTop: '1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                Use the tabs above to manage users, reports, and inventory. Data refreshes every 5 seconds.
              </p>
              <div
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  background: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  color: 'var(--color-text-muted)',
                }}
              >
                <strong style={{ color: 'var(--color-text)' }}>Report status guide</strong>
                <ul style={{ margin: '0.5rem 0 0 1.1rem', lineHeight: 1.7 }}>
                  <li><strong>pending</strong> — victim submitted; assign an NGO to coordinate</li>
                  <li><strong>claimed</strong> — NGO assigned rescue team(s) to the mission</li>
                  <li><strong>in-progress</strong> — team is on the ground</li>
                  <li><strong>resolved</strong> — mission complete</li>
                </ul>
              </div>
            </div>


            {/* Role breakdown */}
            <div className="section-box">
              <h2>👥 Users by Role</h2>
              <div
                style={{
                  display: 'flex',
                  gap: '0.6rem',
                  flexWrap: 'wrap',
                }}
              >
                {Object.entries(roleCounts).map(([role, count]) => (
                  <span
                    key={role}
                    className="badge"
                    style={{
                      ...getRoleBadge(role),
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    {role}: {count}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="section-box" style={{ padding: '0', overflow: 'hidden' }}>
            <h2 style={{ padding: '1.5rem 1.5rem 0.5rem' }}>👥 All Users</h2>
            <FilterBar>
              <input
                type="search"
                className="filter-input"
                placeholder="Search name or email…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
              <select
                className="status-select"
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
              >
                <option value="all">All roles</option>
                {USER_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <span className="filter-count">{filteredUsers.length} shown</span>
            </FilterBar>

            {loadingUsers ? (
              <div className="empty-state">
                <span
                  className="spinner"
                  style={{
                    borderColor: 'var(--color-text-muted)',
                    borderTopColor: 'var(--color-primary)',
                  }}
                />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👤</div>
                <p>No users match your filters.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    minWidth: '600px',
                  }}
                >
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Name</th>
                      <th style={tableHeaderStyle}>Email</th>
                      <th style={tableHeaderStyle}>Role</th>
                      <th style={tableHeaderStyle}>Joined</th>
                      <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => {
                      const uid = u._id || u.id
                      const isCurrentUser = uid === user.id || uid === user._id
                      return (
                        <tr
                          key={uid}
                          style={{
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e =>
                            (e.currentTarget.style.background =
                              'var(--color-surface-2)')
                          }
                          onMouseLeave={e =>
                            (e.currentTarget.style.background = 'transparent')
                          }
                        >
                          <td style={tableCellStyle}>
                            <strong>{u.name}</strong>
                            {isCurrentUser && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  color: 'var(--color-text-subtle)',
                                  marginLeft: '0.5rem',
                                }}
                              >
                                (you)
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              ...tableCellStyle,
                              color: 'var(--color-text-muted)',
                            }}
                          >
                            {u.email}
                          </td>
                          <td style={tableCellStyle}>
                            <span
                              className="badge"
                              style={{
                                ...getRoleBadge(u.role),
                                padding: '0.2rem 0.6rem',
                              }}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td
                            style={{
                              ...tableCellStyle,
                              color: 'var(--color-text-muted)',
                              fontSize: '0.85rem',
                            }}
                          >
                            {u.createdAt
                              ? new Date(u.createdAt).toLocaleDateString()
                              : '—'}
                          </td>
                          <td
                            style={{
                              ...tableCellStyle,
                              textAlign: 'center',
                            }}
                          >
                            {isCurrentUser ? (
                              <span
                                style={{
                                  fontSize: '0.8rem',
                                  color: 'var(--color-text-subtle)',
                                }}
                              >
                                —
                              </span>
                            ) : (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteUser(uid)}
                                disabled={deletingUserId === uid}
                                style={{ width: 'auto' }}
                              >
                                {deletingUserId === uid ? (
                                  <span className="spinner" />
                                ) : (
                                  '🗑️ Delete'
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="section-box" style={{ padding: '0', overflow: 'hidden' }}>
            <h2 style={{ padding: '1.5rem 1.5rem 0.5rem' }}>📋 All Reports</h2>
            <FilterBar>
              <input
                type="search"
                className="filter-input"
                placeholder="Search description, victim, disaster…"
                value={reportSearch}
                onChange={e => setReportSearch(e.target.value)}
              />
              <select
                className="status-select"
                value={reportStatusFilter}
                onChange={e => setReportStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                {REPORT_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                className="status-select"
                value={reportDisasterFilter}
                onChange={e => setReportDisasterFilter(e.target.value)}
              >
                <option value="all">All disasters</option>
                {DISASTER_TYPES.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                className="status-select"
                value={reportNgoFilter}
                onChange={e => setReportNgoFilter(e.target.value)}
              >
                <option value="all">All NGOs</option>
                {ngos.map(n => (
                  <option key={getNgoId(n)} value={getNgoId(n)}>{n.name}</option>
                ))}
              </select>
              <input
                type="search"
                className="filter-input"
                placeholder="Filter NGOs by city/state…"
                value={ngoLocationFilter}
                onChange={e => setNgoLocationFilter(e.target.value)}
                title="Narrows NGO list when assigning (Reports tab)"
              />
              <span className="filter-count">{filteredReports.length} shown</span>
            </FilterBar>

            {loadingReports ? (
              <div className="empty-state">
                <span
                  className="spinner"
                  style={{
                    borderColor: 'var(--color-text-muted)',
                    borderTopColor: 'var(--color-primary)',
                  }}
                />
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <p>No reports match your filters.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    minWidth: '1100px',
                  }}
                >
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Description</th>
                      <th style={tableHeaderStyle}>Victim</th>
                      <th style={tableHeaderStyle}>Disaster</th>
                      <th style={tableHeaderStyle}>Urgency</th>
                      <th style={tableHeaderStyle}>Status</th>
                      <th style={tableHeaderStyle}>Assigned NGO</th>
                      <th style={tableHeaderStyle}>Teams (via NGO)</th>
                      <th style={tableHeaderStyle}>Assign NGO</th>
                      <th style={tableHeaderStyle}>Location</th>
                      <th style={tableHeaderStyle}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.map(r => {
                      const rid = r._id || r.id
                      const assigned = r.assignedTeams || []
                      const assignedNgo = r.assignedNGO
                      const ngoId = assignedNgo ? getNgoId(assignedNgo) : null
                      const locQuery = ngoLocationFilter.trim().toLowerCase()
                      let ngosForRow = filteredNgos.length ? filteredNgos : ngos
                      if (locQuery) {
                        ngosForRow = ngosForRow.filter(n => {
                          const loc = `${n.city || ''} ${n.state || ''}`.toLowerCase()
                          return loc.includes(locQuery)
                        })
                      }
                      const sortedNgos = sortNgosForReport(ngosForRow, r.latitude, r.longitude)
                      const otherNgos = sortedNgos.filter(n => getNgoId(n) !== ngoId)
                      return (
                        <tr key={rid}>
                          <td style={tableCellStyle}>{r.description || '—'}</td>
                          <td style={{ ...tableCellStyle, color: 'var(--color-text-muted)' }}>
                            {r.victim?.name || '—'}
                          </td>
                          <td style={tableCellStyle}>
                            <span className="badge badge-claimed">{r.disasterType || 'Other'}</span>
                          </td>
                          <td style={tableCellStyle}>
                            {r.urgency && (
                              <span
                                className={
                                  r.urgency === 'Medical Emergency'
                                    ? 'badge badge-emergency'
                                    : 'badge badge-normal'
                                }
                              >
                                {r.urgency}
                              </span>
                            )}
                          </td>
                          <td style={tableCellStyle}>
                            <select
                              className="status-select"
                              value={(r.status || 'pending').toLowerCase()}
                              disabled={updatingReportId === rid}
                              onChange={e => handleReportStatus(rid, e.target.value)}
                            >
                              {REPORT_STATUSES.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td style={tableCellStyle}>
                            {assignedNgo ? (
                              <span style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <span className="badge badge-claimed">🏢 {assignedNgo.name}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                  {ngoLocationLabel(assignedNgo)}
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.7rem', alignSelf: 'flex-start' }}
                                  disabled={assigningReportId === rid}
                                  onClick={() => handleUnassignNgo(rid)}
                                >
                                  Remove NGO
                                </button>
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Not assigned</span>
                            )}
                          </td>
                          <td style={tableCellStyle}>
                            {assigned.length === 0 ? (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                {assignedNgo ? 'NGO will assign' : '—'}
                              </span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {assigned.map(team => (
                                  <span key={getTeamId(team)} className="badge badge-claimed">
                                    🚒 {team.name || 'Team'}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td style={tableCellStyle}>
                            <select
                              className="status-select"
                              defaultValue=""
                              disabled={assigningReportId === rid || otherNgos.length === 0}
                              onChange={e => {
                                if (e.target.value) handleAssignNgo(rid, e.target.value)
                                e.target.value = ''
                              }}
                              style={{ minWidth: '200px' }}
                              title="NGOs sorted nearest to report location"
                            >
                              <option value="">
                                {assignedNgo ? 'Change NGO…' : `+ Assign NGO (${otherNgos.length})…`}
                              </option>
                              {otherNgos.map(n => {
                                const dist =
                                  n.distanceKm ??
                                  distanceKm(r.latitude, r.longitude, n.latitude, n.longitude)
                                return (
                                  <option key={getNgoId(n)} value={getNgoId(n)}>
                                    {n.name} — {ngoLocationLabel(n)}
                                    {dist != null ? ` · ${Math.round(dist * 10) / 10} km` : ''}
                                    {` · ${n.activeTasks ?? 0} tasks · ${n.teamCount ?? 0} teams`}
                                  </option>
                                )
                              })}
                            </select>
                          </td>
                          <td style={{ ...tableCellStyle, fontSize: '0.85rem' }}>
                            {mapsLink(r.latitude, r.longitude) ? (
                              <a href={mapsLink(r.latitude, r.longitude)} target="_blank" rel="noreferrer" className="text-link">
                                Map
                              </a>
                            ) : '—'}
                          </td>
                          <td style={{ ...tableCellStyle, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'approvals' && (
          <div className="section-box" style={{ padding: '0', overflow: 'hidden' }}>
            <h2 style={{ padding: '1.5rem 1.5rem 0.5rem' }}>✅ Rescue Team Approvals</h2>
            <p style={{ padding: '0 1.5rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              New rescue team registrations must be approved before they can sign in or be assigned by NGOs.
            </p>
            {loadingApprovals ? (
              <div className="empty-state"><span className="spinner" /></div>
            ) : pendingApprovals.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <p>No pending approval requests.</p>
              </div>
            ) : (
              <div style={{ padding: '0 1.5rem 1.5rem' }}>
                {pendingApprovals.map(u => (
                  <div key={u._id} className="report-card" style={{ marginBottom: '0.75rem' }}>
                    <div className="report-card-info">
                      <div className="report-card-desc">🚒 {u.name}</div>
                      <div className="report-card-meta">
                        <span>{u.email}</span>
                        <span>Registered {new Date(u.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        disabled={approvingId === u._id}
                        onClick={() => handleApproveTeam(u._id)}
                      >
                        {approvingId === u._id ? <span className="spinner" /> : '✓ Approve'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={approvingId === u._id}
                        onClick={() => handleRejectTeam(u._id)}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ngos' && (
          <div className="section-box" style={{ padding: '0', overflow: 'hidden' }}>
            <h2 style={{ padding: '1.5rem 1.5rem 0.5rem' }}>🏢 NGOs</h2>
            <p style={{ padding: '0 1.5rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Assign NGOs to reports from the Reports tab. Filter by city or state to find nearby coordinators.
            </p>
            <FilterBar>
              <input
                type="search"
                className="filter-input"
                placeholder="Search NGO name or email…"
                value={ngoSearch}
                onChange={e => setNgoSearch(e.target.value)}
              />
              <input
                type="search"
                className="filter-input"
                placeholder="City or state…"
                value={ngoLocationFilter}
                onChange={e => setNgoLocationFilter(e.target.value)}
              />
              <span className="filter-count">{filteredNgos.length} shown</span>
            </FilterBar>
            {loadingNgos ? (
              <div className="empty-state"><span className="spinner" /></div>
            ) : filteredNgos.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🏢</div>
                <p>No NGOs registered yet.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Name</th>
                      <th style={tableHeaderStyle}>Location</th>
                      <th style={tableHeaderStyle}>Active tasks</th>
                      <th style={tableHeaderStyle}>Teams</th>
                      <th style={tableHeaderStyle}>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNgos.map(n => (
                      <tr key={getNgoId(n)}>
                        <td style={tableCellStyle}><strong>{n.name}</strong></td>
                        <td style={tableCellStyle}>{ngoLocationLabel(n)}</td>
                        <td style={tableCellStyle}><strong>{n.activeTasks ?? 0}</strong></td>
                        <td style={tableCellStyle}>{n.teamCount ?? 0}</td>
                        <td style={{ ...tableCellStyle, color: 'var(--color-text-muted)' }}>{n.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'teams' && (
          <div className="section-box" style={{ padding: '0', overflow: 'hidden' }}>
            <h2 style={{ padding: '1.5rem 1.5rem 0.5rem' }}>🚒 Rescue Teams</h2>
            <p style={{ padding: '0 1.5rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              NGOs assign teams to missions. Busy = 2+ active assignments.
            </p>
            <FilterBar>
              <input
                type="search"
                className="filter-input"
                placeholder="Search team name or email…"
                value={teamSearch}
                onChange={e => setTeamSearch(e.target.value)}
              />
              <span className="filter-count">{filteredTeams.length} shown</span>
            </FilterBar>
            {loadingTeams ? (
              <div className="empty-state"><span className="spinner" /></div>
            ) : filteredTeams.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🚒</div>
                <p>No rescue teams registered yet.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Name</th>
                      <th style={tableHeaderStyle}>Email</th>
                      <th style={tableHeaderStyle}>Approval</th>
                      <th style={tableHeaderStyle}>Active Missions</th>
                      <th style={tableHeaderStyle}>Availability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeams.map(t => (
                      <tr key={t._id}>
                        <td style={tableCellStyle}><strong>{t.name}</strong></td>
                        <td style={{ ...tableCellStyle, color: 'var(--color-text-muted)' }}>{t.email}</td>
                        <td style={tableCellStyle}>
                          <span
                            className={
                              t.approvalStatus === 'approved'
                                ? 'badge badge-resolved'
                                : t.approvalStatus === 'pending'
                                  ? 'badge badge-pending'
                                  : 'badge badge-emergency'
                            }
                          >
                            {t.approvalStatus || 'approved'}
                          </span>
                        </td>
                        <td style={tableCellStyle}><strong>{t.activeAssignments ?? 0}</strong></td>
                        <td style={tableCellStyle}>
                          <span className={t.isBusy ? 'badge badge-emergency' : 'badge badge-resolved'}>
                            {t.isBusy ? 'Busy' : 'Available'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Resources Tab */}
        {activeTab === 'resources' && (
          <div className="section-box" style={{ padding: '0', overflow: 'hidden' }}>
            <h2 style={{ padding: '1.5rem 1.5rem 1rem' }}>📦 All Resources</h2>

            {loadingResources ? (
              <div className="empty-state">
                <span
                  className="spinner"
                  style={{
                    borderColor: 'var(--color-text-muted)',
                    borderTopColor: 'var(--color-primary)',
                  }}
                />
              </div>
            ) : resources.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <p>No resources in the system yet.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    minWidth: '600px',
                  }}
                >
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Resource</th>
                      <th style={tableHeaderStyle}>Category</th>
                      <th style={tableHeaderStyle}>Quantity</th>
                      <th style={tableHeaderStyle}>Provider</th>
                      <th style={tableHeaderStyle}>Added</th>
                      <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map(r => {
                      const rid = r._id || r.id
                      const catIcons = {
                        Food: '🍚',
                        Water: '💧',
                        Medicine: '💊',
                        Clothing: '👕',
                        Shelter: '🏠',
                        Equipment: '🔧',
                        Transport: '🚛',
                        Other: '📦',
                      }
                      return (
                        <tr
                          key={rid || Math.random()}
                          style={{ transition: 'background 0.15s' }}
                          onMouseEnter={e =>
                            (e.currentTarget.style.background =
                              'var(--color-surface-2)')
                          }
                          onMouseLeave={e =>
                            (e.currentTarget.style.background = 'transparent')
                          }
                        >
                          <td style={tableCellStyle}>
                            <strong>{r.name}</strong>
                          </td>
                          <td style={tableCellStyle}>
                            <span className="badge badge-claimed">
                              {catIcons[r.category] || '📦'} {r.category}
                            </span>
                          </td>
                          <td style={tableCellStyle}>
                            <strong>{r.quantity}</strong>
                          </td>
                          <td
                            style={{
                              ...tableCellStyle,
                              color: 'var(--color-text-muted)',
                            }}
                          >
                            {r.provider?.name || '—'}
                          </td>
                          <td
                            style={{
                              ...tableCellStyle,
                              color: 'var(--color-text-muted)',
                              fontSize: '0.85rem',
                            }}
                          >
                            {r.createdAt
                              ? new Date(r.createdAt).toLocaleDateString()
                              : '—'}
                          </td>
                          <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              style={{ width: 'auto' }}
                              disabled={deletingResourceId === rid}
                              onClick={() => handleDeleteResource(rid)}
                            >
                              {deletingResourceId === rid ? (
                                <span className="spinner" />
                              ) : (
                                '🗑️'
                              )}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Responsive fixes */}
      <style>{`
        @media (max-width: 768px) {
          .dashboard-body > div[style*="grid-template-columns: repeat(5"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .dashboard-body > div[style*="grid-template-columns: repeat(5"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

function FilterBar({ children }) {
  return <div className="filter-bar">{children}</div>
}