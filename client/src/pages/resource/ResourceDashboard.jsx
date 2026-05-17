import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'
import {
  API,
  authHeaders,
  useLiveRefresh,
  RESOURCE_CATEGORIES,
  getResourceCategoryIcon,
  getResourceId,
  getTeamId,
} from '../../api'

export default function ResourceDashboard() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [resources, setResources] = useState([])
  const [teams, setTeams] = useState([])
  const [allocations, setAllocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('stock')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [message, setMessage] = useState({ type: '', text: '' })

  const [stockForm, setStockForm] = useState({ name: '', category: 'Food', quantity: '' })
  const [submitting, setSubmitting] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', category: 'Food', quantity: '' })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const [allocateForm, setAllocateForm] = useState({
    resourceId: '',
    teamId: '',
    quantity: '',
    notes: '',
  })
  const [allocating, setAllocating] = useState(false)
  const [updatingAllocId, setUpdatingAllocId] = useState(null)

  const headers = useMemo(() => authHeaders(token), [token])

  const fetchAll = useCallback(async () => {
    try {
      const [resData, teamsData, allocData] = await Promise.all([
        axios.get(`${API}/resources/mine`, headers),
        axios.get(`${API}/teams`, headers),
        axios.get(`${API}/resources/allocations`, headers),
      ])
      setResources(resData.data.resources || [])
      setTeams(teamsData.data.teams || [])
      setAllocations(allocData.data.allocations || [])
      setLastUpdated(new Date())
    } catch {
      setResources([])
      setTeams([])
      setAllocations([])
    } finally {
      setLoading(false)
    }
  }, [token, headers])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useLiveRefresh(fetchAll, [fetchAll])

  const stats = useMemo(() => {
    const totalStock = resources.reduce((s, r) => s + (r.quantity || 0), 0)
    const available = resources.reduce((s, r) => s + (r.availableQuantity ?? r.quantity ?? 0), 0)
    const reserved = resources.reduce((s, r) => s + (r.reservedQuantity || 0), 0)
    const pendingAlloc = allocations.filter(a => a.status === 'allocated').length
    return { totalStock, available, reserved, pendingAlloc, skuCount: resources.length }
  }, [resources, allocations])

  const selectedResource = resources.find(r => getResourceId(r) === allocateForm.resourceId)

  async function handleAddStock(e) {
    e.preventDefault()
    setMessage({ type: '', text: '' })
    setSubmitting(true)
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
      setMessage({ type: 'success', text: 'Added to stock successfully.' })
      setStockForm({ name: '', category: 'Food', quantity: '' })
      fetchAll()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add stock.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    setEditSubmitting(true)
    setMessage({ type: '', text: '' })
    try {
      await axios.patch(
        `${API}/resources/${editId}`,
        {
          name: editForm.name.trim(),
          category: editForm.category,
          quantity: Number(editForm.quantity),
        },
        headers
      )
      setMessage({ type: 'success', text: 'Stock updated.' })
      setEditId(null)
      fetchAll()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Update failed.' })
    } finally {
      setEditSubmitting(false)
    }
  }

  async function handleDelete(resourceId) {
    if (!window.confirm('Remove this item from stock?')) return
    setDeletingId(resourceId)
    try {
      await axios.delete(`${API}/resources/${resourceId}`, headers)
      setMessage({ type: 'success', text: 'Item removed from stock.' })
      fetchAll()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Delete failed.' })
    } finally {
      setDeletingId(null)
    }
  }

  async function handleAllocate(e) {
    e.preventDefault()
    setAllocating(true)
    setMessage({ type: '', text: '' })
    try {
      await axios.post(
        `${API}/resources/allocate`,
        {
          resourceId: allocateForm.resourceId,
          teamId: allocateForm.teamId,
          quantity: Number(allocateForm.quantity),
          notes: allocateForm.notes.trim(),
        },
        headers
      )
      setMessage({ type: 'success', text: 'Resources allocated to rescue team.' })
      setAllocateForm({ resourceId: '', teamId: '', quantity: '', notes: '' })
      fetchAll()
      setActiveTab('allocations')
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Allocation failed.' })
    } finally {
      setAllocating(false)
    }
  }

  async function updateAllocationStatus(allocId, status) {
    setUpdatingAllocId(allocId)
    setMessage({ type: '', text: '' })
    try {
      await axios.patch(`${API}/resources/allocations/${allocId}`, { status }, headers)
      setMessage({ type: 'success', text: `Allocation marked ${status}.` })
      fetchAll()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Update failed.' })
    } finally {
      setUpdatingAllocId(null)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
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
          {user?.role === 'Admin' && (
            <button
              type="button"
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
          </span>
          <button type="button" className="btn btn-danger btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      <div className="dashboard-body" style={{ maxWidth: '1100px' }}>
        <div className="dashboard-header">
          <h1>📦 Resource Provider Hub</h1>
          <p>Manage relief stock, allocate supplies to rescue teams, and track deliveries.</p>
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
            { label: 'SKUs in stock', value: stats.skuCount, color: 'var(--color-primary)' },
            { label: 'Units available', value: stats.available, color: 'var(--color-success)' },
            { label: 'Reserved for teams', value: stats.reserved, color: 'var(--color-warning)' },
            { label: 'Pending deliveries', value: stats.pendingAlloc, color: 'var(--color-info)' },
          ].map(s => (
            <div key={s.label} className="section-box" style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button type="button" style={tabStyle('stock')} onClick={() => setActiveTab('stock')}>
            📥 Stock ({resources.length})
          </button>
          <button type="button" style={tabStyle('allocate')} onClick={() => setActiveTab('allocate')}>
            🚒 Allocate to teams
          </button>
          <button type="button" style={tabStyle('allocations')} onClick={() => setActiveTab('allocations')}>
            📋 Allocations ({allocations.length})
          </button>
        </div>

        {loading ? (
          <div className="empty-state">
            <span className="spinner" />
          </div>
        ) : (
          <>
            {activeTab === 'stock' && (
              <div className="section-box">
                <h2>📥 Add to stock</h2>
                <form onSubmit={handleAddStock} style={{ marginBottom: '1.5rem' }}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label>Item name</label>
                      <input
                        value={stockForm.name}
                        onChange={e => setStockForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Rice bags, First aid kits"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Category</label>
                      <select
                        value={stockForm.category}
                        onChange={e => setStockForm(f => ({ ...f, category: e.target.value }))}
                      >
                        {RESOURCE_CATEGORIES.map(c => (
                          <option key={c} value={c}>
                            {getResourceCategoryIcon(c)} {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ maxWidth: '200px' }}>
                    <label>Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={stockForm.quantity}
                      onChange={e => setStockForm(f => ({ ...f, quantity: e.target.value }))}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? <span className="spinner" /> : 'Add to stock'}
                  </button>
                </form>

                <h2>📋 Current inventory</h2>
                {resources.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <p>No stock yet. Add items above.</p>
                  </div>
                ) : (
                  resources.map(resource => {
                    const id = getResourceId(resource)
                    const isEditing = editId === id
                    if (isEditing) {
                      return (
                        <form key={id} onSubmit={handleEditSubmit} className="report-card" style={{ flexDirection: 'column' }}>
                          <div className="grid-2">
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>Name</label>
                              <input
                                value={editForm.name}
                                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                required
                              />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>Category</label>
                              <select
                                value={editForm.category}
                                onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                              >
                                {RESOURCE_CATEGORIES.map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="form-group" style={{ maxWidth: '140px', margin: 0 }}>
                            <label>Total quantity</label>
                            <input
                              type="number"
                              min="0"
                              value={editForm.quantity}
                              onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                              required
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="submit" className="btn btn-success btn-sm" disabled={editSubmitting}>
                              Save
                            </button>
                            <button type="button" className="btn btn-sm" onClick={() => setEditId(null)}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      )
                    }
                    return (
                      <div className="report-card" key={id}>
                        <div className="report-card-info">
                          <div className="report-card-desc">
                            {getResourceCategoryIcon(resource.category)} {resource.name}
                          </div>
                          <div className="report-card-meta">
                            <span className="badge badge-claimed">{resource.category}</span>
                            <span>
                              Total: <strong>{resource.quantity}</strong>
                            </span>
                            <span style={{ color: 'var(--color-success)' }}>
                              Available: <strong>{resource.availableQuantity ?? resource.quantity}</strong>
                            </span>
                            {(resource.reservedQuantity || 0) > 0 && (
                              <span style={{ color: 'var(--color-warning)' }}>
                                Reserved: <strong>{resource.reservedQuantity}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ width: 'auto' }}
                            onClick={() => {
                              setAllocateForm(f => ({
                                ...f,
                                resourceId: id,
                                quantity: String(resource.availableQuantity ?? 1),
                              }))
                              setActiveTab('allocate')
                            }}
                          >
                            Allocate
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ width: 'auto' }}
                            onClick={() => {
                              setEditId(id)
                              setEditForm({
                                name: resource.name,
                                category: resource.category,
                                quantity: resource.quantity,
                              })
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            disabled={deletingId === id}
                            onClick={() => handleDelete(id)}
                          >
                            {deletingId === id ? <span className="spinner" /> : '✕'}
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {activeTab === 'allocate' && (
              <div className="section-box">
                <h2>🚒 Allocate stock to rescue team</h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Reserve units for a team. Mark as delivered when they collect supplies — stock is deducted then.
                </p>
                {resources.length === 0 || teams.length === 0 ? (
                  <div className="empty-state">
                    <p>
                      {resources.length === 0
                        ? 'Add stock first.'
                        : 'No rescue teams on the platform yet.'}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleAllocate}>
                    <div className="form-group">
                      <label>Stock item</label>
                      <select
                        value={allocateForm.resourceId}
                        onChange={e =>
                          setAllocateForm(f => ({ ...f, resourceId: e.target.value, quantity: '' }))
                        }
                        required
                      >
                        <option value="">Select item…</option>
                        {resources.map(r => (
                          <option key={getResourceId(r)} value={getResourceId(r)}>
                            {r.name} — {r.availableQuantity ?? 0} available ({r.category})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid-2">
                      <div className="form-group">
                        <label>Rescue team</label>
                        <select
                          value={allocateForm.teamId}
                          onChange={e => setAllocateForm(f => ({ ...f, teamId: e.target.value }))}
                          required
                        >
                          <option value="">Select team…</option>
                          {teams.map(t => (
                            <option key={getTeamId(t)} value={getTeamId(t)}>
                              {t.name}
                              {t.affiliatedNGO ? '' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Quantity</label>
                        <input
                          type="number"
                          min="1"
                          max={selectedResource?.availableQuantity ?? undefined}
                          value={allocateForm.quantity}
                          onChange={e => setAllocateForm(f => ({ ...f, quantity: e.target.value }))}
                          required
                        />
                        {selectedResource && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            Max {selectedResource.availableQuantity} available
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Notes for the team (optional)</label>
                      <textarea
                        value={allocateForm.notes}
                        onChange={e => setAllocateForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Pickup location, batch numbers, expiry…"
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)',
                          color: 'var(--color-text)',
                          fontFamily: 'var(--font-sans)',
                        }}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={allocating}>
                      {allocating ? <span className="spinner" /> : 'Confirm allocation'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {activeTab === 'allocations' && (
              <div className="section-box">
                <h2>📋 Allocation history</h2>
                {allocations.length === 0 ? (
                  <div className="empty-state">
                    <p>No allocations yet.</p>
                  </div>
                ) : (
                  allocations.map(alloc => {
                    const aid = alloc._id || alloc.id
                    return (
                      <div className="report-card" key={aid} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <div className="report-card-desc">
                              {getResourceCategoryIcon(alloc.resource?.category)}{' '}
                              {alloc.quantity}× {alloc.resource?.name}
                            </div>
                            <div className="report-card-meta">
                              <span className={`badge ${alloc.status === 'delivered' ? 'badge-resolved' : alloc.status === 'cancelled' ? 'badge-emergency' : 'badge-claimed'}`}>
                                {alloc.status}
                              </span>
                              <span>🚒 {alloc.rescueTeam?.name}</span>
                              <span>{new Date(alloc.createdAt).toLocaleString()}</span>
                            </div>
                            {alloc.notes && (
                              <p style={{ fontSize: '0.85rem', marginTop: '0.35rem', color: 'var(--color-text-muted)' }}>
                                {alloc.notes}
                              </p>
                            )}
                          </div>
                          {alloc.status === 'allocated' && (
                            <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                style={{ width: 'auto' }}
                                disabled={updatingAllocId === aid}
                                onClick={() => updateAllocationStatus(aid, 'delivered')}
                              >
                                Mark delivered
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                style={{ width: 'auto' }}
                                disabled={updatingAllocId === aid}
                                onClick={() => updateAllocationStatus(aid, 'cancelled')}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
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
