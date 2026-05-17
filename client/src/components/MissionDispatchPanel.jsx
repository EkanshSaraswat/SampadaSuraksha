import { useState, useEffect } from 'react'
import { NEED_OPTIONS } from '../api'

const emptyResource = () => ({
  name: '',
  category: 'Other',
  quantity: 1,
  source: 'other',
  sourceLabel: '',
})

export default function MissionDispatchPanel({
  report,
  teams,
  stock,
  providers,
  onDispatch,
  onUpdateBriefing,
  onCancel,
  existingBriefing,
  teamId: initialTeamId,
  busy,
}) {
  const [teamId, setTeamId] = useState(initialTeamId || '')
  const [instructions, setInstructions] = useState(existingBriefing?.instructions || '')
  const [resources, setResources] = useState(
    existingBriefing?.resources?.length
      ? existingBriefing.resources.map(r => ({ ...r }))
      : []
  )
  const [stockPick, setStockPick] = useState('')
  const [providerPick, setProviderPick] = useState('')

  useEffect(() => {
    if (existingBriefing) {
      setInstructions(existingBriefing.instructions || '')
      setResources(
        existingBriefing.resources?.length
          ? existingBriefing.resources.map(r => ({ ...r }))
          : []
      )
      if (initialTeamId) setTeamId(initialTeamId)
    }
  }, [existingBriefing, initialTeamId])

  const victimNeeds = report?.needs || []

  function addFromStock(itemId) {
    const item = stock.find(s => (s._id || s.id) === itemId)
    if (!item) return
    setResources(prev => [
      ...prev,
      {
        name: item.name,
        category: item.category,
        quantity: 1,
        source: 'ngo_stock',
        sourceLabel: 'Your NGO stock',
      },
    ])
    setStockPick('')
  }

  function addFromProvider(value) {
    if (!value) return
    const [providerId, resourceId] = value.split('::')
    const group = providers.find(g => (g.provider?._id || g.provider?.id) === providerId)
    const item = group?.resources?.find(r => (r._id || r.id) === resourceId)
    if (!item) return
    setResources(prev => [
      ...prev,
      {
        name: item.name,
        category: item.category,
        quantity: 1,
        source: 'provider',
        sourceLabel: group.provider?.name || 'Resource provider',
      },
    ])
    setProviderPick('')
  }

  function addCustom() {
    setResources(prev => [...prev, emptyResource()])
  }

  function updateResource(idx, field, value) {
    setResources(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }

  function removeResource(idx) {
    setResources(prev => prev.filter((_, i) => i !== idx))
  }

  function suggestFromVictimNeeds() {
    const lines = victimNeeds.map(need => {
      const label = NEED_OPTIONS.find(n => n.value === need)?.label || need
      const match = stock.find(
        s => s.category === need || s.name.toLowerCase().includes(need.toLowerCase())
      )
      if (match) {
        return {
          name: match.name,
          category: match.category,
          quantity: 1,
          source: 'ngo_stock',
          sourceLabel: 'Your NGO stock',
        }
      }
      return {
        name: label,
        category: need === 'Medical' ? 'Medicine' : need,
        quantity: 1,
        source: 'other',
        sourceLabel: 'Obtain locally',
      }
    })
    setResources(lines)
    if (!instructions.trim()) {
      setInstructions(
        `Victim needs: ${victimNeeds.map(n => NEED_OPTIONS.find(o => o.value === n)?.label || n).join(', ')}. Gather listed resources before departure.`
      )
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!teamId) return
    const payload = {
      teamId,
      instructions: instructions.trim(),
      resources: resources.filter(r => r.name?.trim()),
    }
    if (existingBriefing) onUpdateBriefing(payload)
    else onDispatch(payload)
  }

  const freeTeams = teams.filter(t => !t.isBusy && (t.activeAssignments ?? 0) < 2)

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: '1rem',
        padding: '1rem',
        background: 'var(--color-surface-2)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)',
      }}
    >
      <strong style={{ display: 'block', marginBottom: '0.75rem' }}>
        {existingBriefing ? '✏️ Update team briefing' : '🚒 Dispatch rescue team'}
      </strong>

      {!existingBriefing && (
        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
          <label>Select team</label>
          <select
            className="status-select"
            value={teamId}
            onChange={e => setTeamId(e.target.value)}
            required
            style={{ width: '100%' }}
          >
            <option value="">Choose a team…</option>
            {freeTeams.map(t => (
              <option key={t._id || t.id} value={t._id || t.id}>
                {t.name} — available
              </option>
            ))}
            {teams.filter(t => t.isBusy).map(t => (
              <option key={`busy-${t._id}`} disabled value="">
                {t.name} — busy
              </option>
            ))}
          </select>
          {teams.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--color-warning)', marginTop: '0.35rem' }}>
              Create a rescue team under the Rescue teams tab first.
            </p>
          )}
        </div>
      )}

      {victimNeeds.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Victim needs: </span>
          {victimNeeds.map(need => (
            <span key={need} className="badge" style={{ marginRight: '0.25rem', fontSize: '0.7rem' }}>
              {NEED_OPTIONS.find(n => n.value === need)?.label || need}
            </span>
          ))}
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginLeft: '0.5rem', width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={suggestFromVictimNeeds}
          >
            Auto-fill resources from needs
          </button>
        </div>
      )}

      <div className="form-group" style={{ marginBottom: '0.75rem' }}>
        <label>Instructions for the team</label>
        <textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder="Where to go, what to prioritize, safety notes, contact info…"
          rows={3}
          style={{
            width: '100%',
            padding: '0.6rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-sans)',
            resize: 'vertical',
          }}
        />
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Resources to bring</label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {stock.length > 0 && (
            <select
              className="status-select"
              value={stockPick}
              onChange={e => {
                setStockPick(e.target.value)
                if (e.target.value) addFromStock(e.target.value)
              }}
              style={{ minWidth: '160px' }}
            >
              <option value="">+ From your stock…</option>
              {stock.map(s => (
                <option key={s._id || s.id} value={s._id || s.id}>
                  {s.name} ({s.quantity} {s.category})
                </option>
              ))}
            </select>
          )}
          {providers.length > 0 && (
            <select
              className="status-select"
              value={providerPick}
              onChange={e => {
                setProviderPick(e.target.value)
                if (e.target.value) addFromProvider(e.target.value)
              }}
              style={{ minWidth: '180px' }}
            >
              <option value="">+ From provider…</option>
              {providers.flatMap(g => {
                const pid = g.provider?._id || g.provider?.id
                return (g.resources || []).map(r => (
                  <option key={`${pid}-${r._id}`} value={`${pid}::${r._id || r.id}`}>
                    {r.name} — {g.provider?.name}
                  </option>
                ))
              })}
            </select>
          )}
          <button type="button" className="btn btn-sm" style={{ width: 'auto' }} onClick={addCustom}>
            + Custom item
          </button>
        </div>

        {resources.length > 0 && (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {resources.map((r, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 80px auto',
                  gap: '0.35rem',
                  alignItems: 'center',
                }}
              >
                <input
                  value={r.name}
                  onChange={e => updateResource(idx, 'name', e.target.value)}
                  placeholder="Item name"
                  required
                />
                <select
                  value={r.category}
                  onChange={e => updateResource(idx, 'category', e.target.value)}
                >
                  {['Food', 'Water', 'Medicine', 'Clothing', 'Shelter', 'Equipment', 'Transport', 'Other'].map(
                    c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    )
                  )}
                </select>
                <input
                  type="number"
                  min="1"
                  value={r.quantity}
                  onChange={e => updateResource(idx, 'quantity', Number(e.target.value))}
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ width: 'auto', padding: '0.2rem 0.5rem' }}
                  onClick={() => removeResource(idx)}
                >
                  ✕
                </button>
                {r.sourceLabel && (
                  <span
                    style={{
                      gridColumn: '1 / -1',
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    Source: {r.sourceLabel}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !teamId}>
          {busy ? <span className="spinner" /> : existingBriefing ? 'Save briefing' : 'Assign & send briefing'}
        </button>
        <button type="button" className="btn btn-sm" style={{ width: 'auto' }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
