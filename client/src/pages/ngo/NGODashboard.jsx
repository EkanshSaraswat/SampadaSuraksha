import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'
import MissionDispatchPanel from '../../components/MissionDispatchPanel'
import {
  API,
  authHeaders,
  useLiveRefresh,
  mapsLink,
  getTeamId,
  getBriefingForTeam,
  isAvailableRescueTeam,
  NEED_OPTIONS,
} from '../../api'

const STOCK_CATEGORIES = ['Food', 'Water', 'Medicine', 'Clothing', 'Shelter', 'Equipment', 'Transport', 'Other']

const emptyTeamMember = () => ({ name: '', contact: '', email: '' })

export default function NGODashboard() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [reports, setReports] = useState([])
  const [teams, setTeams] = useState([])
  const [stock, setStock] = useState([])
  const [providers, setProviders] = useState([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [loadingStock, setLoadingStock] = useState(true)
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [activeTab, setActiveTab] = useState('tasks')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [updatingReportId, setUpdatingReportId] = useState(null)
  const [assigningReportId, setAssigningReportId] = useState(null)
  const [stockForm, setStockForm] = useState({ name: '', category: 'Food', quantity: '' })
  const [savingStock, setSavingStock] = useState(false)
  const [teamForm, setTeamForm] = useState({
    teamName: '',
    email: '',
    password: '',
    members: [emptyTeamMember()],
  })
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [linkEmail, setLinkEmail] = useState('')
  const [linkingTeam, setLinkingTeam] = useState(false)
  const [dispatchMode, setDispatchMode] = useState(null)
  // { reportId, teamId?, mode: 'new' | 'edit' }

  const headers = useMemo(() => authHeaders(token), [token])

  const fetchReports = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/reports/assigned`, headers)
      setReports(data.reports || [])
      setLastUpdated(new Date())
    } catch {
      setReports([])
    } finally {
      setLoadingReports(false)
    }
  }, [token, headers])

  const fetchTeams = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/teams?mine=true`, headers)
      setTeams(data.teams || [])
    } catch {
      setTeams([])
    } finally {
      setLoadingTeams(false)
    }
  }, [token, headers])

  const fetchStock = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/resources/stock`, headers)
      setStock(data.resources || [])
    } catch {
      setStock([])
    } finally {
      setLoadingStock(false)
    }
  }, [token, headers])

  const fetchProviders = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/resources/providers`, headers)
      setProviders(data.providers || [])
    } catch {
      setProviders([])
    } finally {
      setLoadingProviders(false)
    }
  }, [token, headers])

  const refreshAll = useCallback(() => {
    fetchReports()
    fetchTeams()
    fetchStock()
    fetchProviders()
  }, [fetchReports, fetchTeams, fetchStock, fetchProviders])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  useLiveRefresh(refreshAll, [refreshAll])

  const activeTasks = useMemo(
    () => reports.filter(r => (r.status || 'pending') !== 'resolved'),
    [reports]
  )

  async function handleDispatchTeam(reportId, payload) {
    setAssigningReportId(reportId)
    setMessage({ type: '', text: '' })
    try {
      await axios.patch(`${API}/reports/assign-team/${reportId}`, payload, headers)
      setMessage({ type: 'success', text: 'Team dispatched with resource briefing.' })
      setDispatchMode(null)
      fetchReports()
      fetchTeams()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to dispatch team.',
      })
    } finally {
      setAssigningReportId(null)
    }
  }

  async function handleUpdateBriefing(reportId, payload) {
    setAssigningReportId(reportId)
    setMessage({ type: '', text: '' })
    try {
      await axios.patch(`${API}/reports/briefing/${reportId}`, payload, headers)
      setMessage({ type: 'success', text: 'Team briefing updated.' })
      setDispatchMode(null)
      fetchReports()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update briefing.',
      })
    } finally {
      setAssigningReportId(null)
    }
  }

  function updateTeamMember(index, field, value) {
    setTeamForm(f => ({
      ...f,
      members: f.members.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    }))
  }

  function addTeamMemberRow() {
    setTeamForm(f => ({ ...f, members: [...f.members, emptyTeamMember()] }))
  }

  function removeTeamMemberRow(index) {
    setTeamForm(f => ({
      ...f,
      members: f.members.length > 1 ? f.members.filter((_, i) => i !== index) : f.members,
    }))
  }

  async function handleCreateTeam(e) {
    e.preventDefault()
    setCreatingTeam(true)
    setMessage({ type: '', text: '' })
    try {
      const { data } = await axios.post(
        `${API}/teams`,
        {
          teamName: teamForm.teamName.trim(),
          email: teamForm.email.trim(),
          password: teamForm.password,
          members: teamForm.members,
        },
        headers
      )
      setMessage({
        type: 'success',
        text: data.message || 'Rescue team created. Share the login email and password with the team.',
      })
      setTeamForm({
        teamName: '',
        email: '',
        password: '',
        members: [emptyTeamMember()],
      })
      fetchTeams()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to create team.',
      })
    } finally {
      setCreatingTeam(false)
    }
  }

  async function handleLinkTeam(e) {
    e.preventDefault()
    setLinkingTeam(true)
    setMessage({ type: '', text: '' })
    try {
      const { data } = await axios.patch(
        `${API}/teams/link`,
        { email: linkEmail.trim() },
        headers
      )
      setMessage({
        type: 'success',
        text: data.message || 'Rescue team linked successfully.',
      })
      setLinkEmail('')
      fetchTeams()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to link team.',
      })
    } finally {
      setLinkingTeam(false)
    }
  }

  async function handleUnassignTeam(reportId, teamId) {
    setAssigningReportId(reportId)
    setMessage({ type: '', text: '' })
    try {
      await axios.patch(`${API}/reports/unassign-team/${reportId}`, { teamId }, headers)
      setMessage({ type: 'success', text: 'Team removed from mission.' })
      fetchReports()
      fetchTeams()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to unassign team.',
      })
    } finally {
      setAssigningReportId(null)
    }
  }

  async function handleStatusChange(reportId, status) {
    setUpdatingReportId(reportId)
    setMessage({ type: '', text: '' })
    try {
      await axios.patch(`${API}/reports/${reportId}/status`, { status }, headers)
      setMessage({ type: 'success', text: 'Mission status updated.' })
      fetchReports()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update status.',
      })
    } finally {
      setUpdatingReportId(null)
    }
  }

  async function handleAddStock(e) {
    e.preventDefault()
    setSavingStock(true)
    setMessage({ type: '', text: '' })
    try {
      await axios.post(
        `${API}/resources`,
        {
          name: stockForm.name.trim(),
          category: stockForm.category,
          quantity: Number(stockForm.quantity),
        },
        headers
      )
      setMessage({ type: 'success', text: 'Stock item added.' })
      setStockForm({ name: '', category: 'Food', quantity: '' })
      fetchStock()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to add stock.',
      })
    } finally {
      setSavingStock(false)
    }
  }

  async function handleDeleteStock(resourceId) {
    if (!window.confirm('Remove this item from your stock?')) return
    try {
      await axios.delete(`${API}/resources/${resourceId}`, headers)
      setMessage({ type: 'success', text: 'Stock item removed.' })
      fetchStock()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to delete stock.',
      })
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

  function needLabel(value) {
    return NEED_OPTIONS.find(n => n.value === value)?.label || value
  }

  const stockTotal = stock.reduce((sum, r) => sum + (r.quantity || 0), 0)
  const providerResourceCount = providers.reduce(
    (sum, g) => sum + (g.resources?.length || 0),
    0
  )

  const tabStyle = tab => ({
    padding: '0.6rem 1.2rem',
    border: 'none',
    background: activeTab === tab ? 'var(--color-primary)' : 'var(--color-surface-2)',
    color: activeTab === tab ? '#fff' : 'var(--color-text-muted)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.9rem',
    fontWeight: 600,
  })

  return (
    <div className="dashboard-layout">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="icon">🛡️</span> SampadaSuraksha
        </div>
        <div className="navbar-meta">
          {user?.role === 'Admin' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/admin/dashboard')}
              style={{ marginRight: '1rem' }}
            >
              Back to Admin
            </button>
          )}
          {lastUpdated && (
            <span className="live-badge">● Live · {lastUpdated.toLocaleTimeString()}</span>
          )}
          <span className="navbar-user">
            Welcome, <strong>{user?.name}</strong>
            {(user?.city || user?.state) && (
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>
                {' '}
                · {[user.city, user.state].filter(Boolean).join(', ')}
              </span>
            )}
          </span>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      <div className="dashboard-body">
        <div className="dashboard-header">
          <h1>🏢 NGO Dashboard</h1>
          <p>
            Missions assigned by admin — dispatch rescue teams and coordinate resources for
            your area.
          </p>
        </div>

        {message.text && (
          <div className={`alert alert-${message.type}`}>{message.text}</div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div className="section-box" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-warning)' }}>
              {activeTasks.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Active tasks
            </div>
          </div>
          <div className="section-box" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-info)' }}>
              {teams.filter(isAvailableRescueTeam).length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Teams available
            </div>
          </div>
          <div className="section-box" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              {stockTotal}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Our stock (units)
            </div>
          </div>
          <div className="section-box" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-success)' }}>
              {providerResourceCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Provider listings
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button style={tabStyle('tasks')} onClick={() => setActiveTab('tasks')}>
            📋 Active tasks ({activeTasks.length})
          </button>
          <button style={tabStyle('teams')} onClick={() => setActiveTab('teams')}>
            🚒 Rescue teams ({teams.length})
          </button>
          <button style={tabStyle('stock')} onClick={() => setActiveTab('stock')}>
            📦 Our stock ({stock.length})
          </button>
          <button style={tabStyle('providers')} onClick={() => setActiveTab('providers')}>
            🤝 Resource providers ({providers.length})
          </button>
        </div>

        {activeTab === 'tasks' && (
          <div className="section-box">
            <h2>📋 Active tasks</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Reports assigned to your NGO by the admin. Assign rescue teams to dispatch help.
            </p>

            {loadingReports ? (
              <div className="empty-state"><span className="spinner" /></div>
            ) : activeTasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <p>No active tasks assigned yet.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-subtle)' }}>
                  The admin will assign disaster reports to your NGO based on location.
                </p>
              </div>
            ) : (
              activeTasks.map(report => {
                const id = report._id || report.id
                const assigned = report.assignedTeams || []
                const isDispatching =
                  dispatchMode?.reportId === id && dispatchMode?.mode === 'new'
                const isEditingBriefing =
                  dispatchMode?.reportId === id && dispatchMode?.mode === 'edit'

                return (
                  <div className="report-card" key={id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                      <div className="report-card-info" style={{ flex: 1 }}>
                        <div className="report-card-desc">{report.description}</div>
                        <div className="report-card-meta">
                          {report.urgency && (
                            <span className={getUrgencyBadge(report.urgency)}>{report.urgency}</span>
                          )}
                          <span className={getStatusBadge(report.status)}>
                            {report.status || 'pending'}
                          </span>
                          {report.disasterType && (
                            <span className="badge badge-claimed">{report.disasterType}</span>
                          )}
                          {report.victim?.name && <span>👤 {report.victim.name}</span>}
                          {mapsLink(report.latitude, report.longitude) && (
                            <a
                              href={mapsLink(report.latitude, report.longitude)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-link"
                            >
                              📍 Map
                            </a>
                          )}
                        </div>
                        {report.needs?.length > 0 && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {report.needs.map(need => (
                              <span key={need} className="badge" style={{ fontSize: '0.75rem' }}>
                                {needLabel(need)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <select
                        className="status-select"
                        value={(report.status || 'pending').toLowerCase()}
                        disabled={updatingReportId === id}
                        onChange={e => handleStatusChange(id, e.target.value)}
                        style={{ minWidth: '130px', alignSelf: 'flex-start' }}
                      >
                        <option value="pending">Pending</option>
                        <option value="claimed">Claimed</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>

                    <div
                      style={{
                        marginTop: '1rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--color-border)',
                      }}
                    >
                      <strong style={{ fontSize: '0.85rem' }}>Dispatched teams</strong>
                      {assigned.length === 0 ? (
                        <p style={{ margin: '0.5rem 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                          No team yet — dispatch a team with resource instructions below.
                        </p>
                      ) : (
                        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {assigned.map(team => {
                            const tid = getTeamId(team)
                            const briefing = getBriefingForTeam(report, tid)
                            return (
                              <div
                                key={tid}
                                style={{
                                  padding: '0.75rem',
                                  background: 'var(--color-surface)',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--color-border)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  <span className="badge badge-claimed">🚒 {team.name}</span>
                                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm"
                                      style={{ width: 'auto', fontSize: '0.75rem' }}
                                      onClick={() =>
                                        setDispatchMode({ reportId: id, teamId: tid, mode: 'edit' })
                                      }
                                    >
                                      Edit briefing
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                      style={{ width: 'auto', fontSize: '0.75rem' }}
                                      disabled={assigningReportId === id}
                                      onClick={() => handleUnassignTeam(id, tid)}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                                {briefing?.instructions && (
                                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                                    {briefing.instructions}
                                  </p>
                                )}
                                {briefing?.resources?.length > 0 && (
                                  <ul style={{ margin: '0.35rem 0 0 1rem', fontSize: '0.85rem' }}>
                                    {briefing.resources.map((r, i) => (
                                      <li key={i}>
                                        {r.quantity}× {r.name} ({r.category})
                                        {r.sourceLabel ? ` — ${r.sourceLabel}` : ''}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {isEditingBriefing && dispatchMode.teamId === tid && (
                                  <MissionDispatchPanel
                                    report={report}
                                    teams={teams}
                                    stock={stock}
                                    providers={providers}
                                    existingBriefing={briefing}
                                    teamId={tid}
                                    busy={assigningReportId === id}
                                    onUpdateBriefing={p => handleUpdateBriefing(id, p)}
                                    onCancel={() => setDispatchMode(null)}
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {!isDispatching && !isEditingBriefing && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: '0.75rem', width: 'auto' }}
                          disabled={teams.length === 0}
                          onClick={() => setDispatchMode({ reportId: id, mode: 'new' })}
                        >
                          + Dispatch rescue team
                        </button>
                      )}

                      {isDispatching && (
                        <MissionDispatchPanel
                          report={report}
                          teams={teams}
                          stock={stock}
                          providers={providers}
                          busy={assigningReportId === id}
                          onDispatch={p => handleDispatchTeam(id, p)}
                          onCancel={() => setDispatchMode(null)}
                        />
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {activeTab === 'teams' && (
          <div className="section-box">
            <h2>🚒 Your rescue teams</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Create teams under your NGO, then dispatch them with resource briefings on active tasks.
            </p>

            <form
              onSubmit={handleCreateTeam}
              style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                background: 'var(--color-surface-2)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
              }}
            >
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Create rescue team</h3>

              <div className="form-group">
                <label htmlFor="team-name">Team name</label>
                <input
                  id="team-name"
                  value={teamForm.teamName}
                  onChange={e => setTeamForm(f => ({ ...f, teamName: e.target.value }))}
                  placeholder="e.g. Alpha Rescue Unit"
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <label style={{ margin: 0, fontWeight: 600 }}>Team members</label>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ width: 'auto' }}
                    onClick={addTeamMemberRow}
                  >
                    + Add member
                  </button>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0 0 0.75rem' }}>
                  Name and contact are required. Email is optional for each member.
                </p>
                {teamForm.members.map((member, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr auto',
                      gap: '0.5rem',
                      marginBottom: '0.5rem',
                      alignItems: 'end',
                    }}
                  >
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Member name</label>
                      <input
                        value={member.name}
                        onChange={e => updateTeamMember(index, 'name', e.target.value)}
                        placeholder="Full name"
                        required
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Contact</label>
                      <input
                        value={member.contact}
                        onChange={e => updateTeamMember(index, 'contact', e.target.value)}
                        placeholder="Phone number"
                        required
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Email</label>
                      <input
                        type="email"
                        value={member.email}
                        onChange={e => updateTeamMember(index, 'email', e.target.value)}
                        placeholder="member@email.com"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ width: 'auto', marginBottom: '0.15rem' }}
                      disabled={teamForm.members.length <= 1}
                      onClick={() => removeTeamMemberRow(index)}
                      title="Remove member"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="team-login-email">Team login email</label>
                  <input
                    id="team-login-email"
                    type="email"
                    value={teamForm.email}
                    onChange={e => setTeamForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="Used to sign in to the app"
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="team-password">Password</label>
                  <input
                    id="team-password"
                    type="password"
                    value={teamForm.password}
                    onChange={e => setTeamForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 6 characters"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={creatingTeam}>
                {creatingTeam ? <span className="spinner" /> : 'Create rescue team'}
              </button>
            </form>

            {/* Link Existing Team Form */}
            <form
              onSubmit={handleLinkTeam}
              style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                background: 'var(--color-surface-2)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
              }}
            >
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Link existing rescue team</h3>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label htmlFor="link-team-email">Team login email</label>
                <input
                  id="link-team-email"
                  type="email"
                  value={linkEmail}
                  onChange={e => setLinkEmail(e.target.value)}
                  placeholder="Enter the email of the existing rescue team"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={linkingTeam}>
                {linkingTeam ? <span className="spinner" /> : 'Link Team'}
              </button>
            </form>

            {loadingTeams ? (
              <div className="empty-state"><span className="spinner" /></div>
            ) : teams.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <p>No teams yet. Create one above to start dispatching missions.</p>
              </div>
            ) : (
              teams.map(team => (
                <div
                  className="report-card"
                  key={getTeamId(team)}
                  style={{ flexDirection: 'column', alignItems: 'stretch' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div className="report-card-info">
                      <div className="report-card-desc">🚒 {team.name}</div>
                      <div className="report-card-meta">
                        <span>Login: {team.email}</span>
                        <span>
                          <strong>{team.activeAssignments ?? 0}</strong> active missions
                        </span>
                        <span className={team.isBusy ? 'badge badge-emergency' : 'badge badge-resolved'}>
                          {team.isBusy ? 'Busy' : 'Available'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {(team.teamMembers || []).length > 0 && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                      <strong>Members ({team.teamMembers.length})</strong>
                      <ul style={{ margin: '0.35rem 0 0 1.1rem', lineHeight: 1.6 }}>
                        {team.teamMembers.map((m, i) => (
                          <li key={i}>
                            {m.name} — {m.contact}
                            {m.email ? ` · ${m.email}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'stock' && (
          <div className="section-box">
            <h2>📦 Our relief stock</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Inventory your NGO holds on hand for field teams.
            </p>

            <form
              onSubmit={handleAddStock}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr auto',
                gap: '0.5rem',
                marginBottom: '1.5rem',
                alignItems: 'end',
              }}
            >
              <div className="form-group" style={{ margin: 0 }}>
                <label>Item name</label>
                <input
                  value={stockForm.name}
                  onChange={e => setStockForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Rice bags"
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Category</label>
                <select
                  value={stockForm.category}
                  onChange={e => setStockForm(f => ({ ...f, category: e.target.value }))}
                >
                  {STOCK_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={stockForm.quantity}
                  onChange={e => setStockForm(f => ({ ...f, quantity: e.target.value }))}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={savingStock}>
                {savingStock ? <span className="spinner" /> : '+ Add'}
              </button>
            </form>

            {loadingStock ? (
              <div className="empty-state"><span className="spinner" /></div>
            ) : stock.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <p>No stock recorded yet. Add items above.</p>
              </div>
            ) : (
              stock.map(item => (
                <div className="report-card" key={item._id || item.id}>
                  <div className="report-card-info">
                    <div className="report-card-desc">{item.name}</div>
                    <div className="report-card-meta">
                      <span className="badge badge-claimed">{item.category}</span>
                      <span>
                        Qty: <strong>{item.quantity}</strong>
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDeleteStock(item._id || item.id)}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'providers' && (
          <div className="section-box">
            <h2>🤝 Resource providers</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Refer field teams to these suppliers when your stock is not enough.
            </p>

            {loadingProviders ? (
              <div className="empty-state"><span className="spinner" /></div>
            ) : providers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🤝</div>
                <p>No resource providers registered yet.</p>
              </div>
            ) : (
              providers.map((group, idx) => {
                const p = group.provider
                const loc = [p?.city, p?.state].filter(Boolean).join(', ')
                return (
                  <div
                    key={p?._id || idx}
                    style={{
                      marginBottom: '1.25rem',
                      padding: '1rem',
                      background: 'var(--color-surface-2)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <strong>{p?.name || 'Provider'}</strong>
                        {p?.email && (
                          <span style={{ marginLeft: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                            ✉️ {p.email}
                          </span>
                        )}
                      </div>
                      {loc && (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>📍 {loc}</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '0.5rem 0' }}>
                      {group.resources?.length || 0} items · {group.totalQty ?? 0} total units
                      {group.categories?.length > 0 && ` · ${group.categories.join(', ')}`}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {(group.resources || []).map(r => (
                        <div
                          key={r._id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.9rem',
                            padding: '0.35rem 0',
                            borderBottom: '1px solid var(--color-border)',
                          }}
                        >
                          <span>{r.name}</span>
                          <span>
                            <span className="badge badge-claimed" style={{ marginRight: '0.5rem' }}>
                              {r.category}
                            </span>
                            Qty {r.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 700px) {
          .dashboard-body > div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 600px) {
          form[style*="grid-template-columns: 2fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
