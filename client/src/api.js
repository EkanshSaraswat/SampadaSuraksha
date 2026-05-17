import { useEffect } from 'react'

/** API base — use /api in dev (Vite proxy); set VITE_API_URL in production builds */
export const API = import.meta.env.VITE_API_URL || '/api'

export const LIVE_REFRESH_MS = 5000

export function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}` } }
}

/** Poll data on an interval for live dashboard updates */
export function useLiveRefresh(callback, deps, intervalMs = LIVE_REFRESH_MS) {
  useEffect(() => {
    const id = setInterval(callback, intervalMs)
    return () => clearInterval(id)
  }, deps)
}

export const NEED_OPTIONS = [
  { value: 'Food', label: 'Food', icon: '🍚' },
  { value: 'Water', label: 'Water', icon: '💧' },
  { value: 'Medicine', label: 'Medicine', icon: '💊' },
  { value: 'Clothing', label: 'Clothing', icon: '👕' },
  { value: 'Shelter', label: 'Shelter', icon: '🏠' },
  { value: 'Equipment', label: 'Equipment', icon: '🔧' },
  { value: 'Transport', label: 'Transport', icon: '🚛' },
  { value: 'Medical', label: 'Medical care', icon: '🏥' },
  { value: 'Other', label: 'Other', icon: '📦' },
]

export const DISASTER_TYPES = [
  'Earthquake',
  'Flood',
  'Cyclone',
  'Fire',
  'Landslide',
  'Drought',
  'Other',
]

export const USER_ROLES = ['Victim', 'RescueTeam', 'NGO', 'Admin', 'ResourceProvider']

export const REPORT_STATUSES = ['pending', 'claimed', 'in-progress', 'resolved']

/** Fuzzy text match — substring + all query words must appear */
export function getTeamId(team) {
  return String(team?._id ?? team?.id ?? '')
}

export function getNgoId(ngo) {
  return String(ngo?._id ?? ngo?.id ?? '')
}

/** Haversine distance (km) — mirrors server geo util for client-side NGO sorting */
export function distanceKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => v == null || Number.isNaN(Number(v)))) return null
  const R = 6371
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function ngoLocationLabel(ngo) {
  const parts = [ngo?.city, ngo?.state].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Location not set'
}

export function sortNgosForReport(ngos, reportLat, reportLng) {
  return [...ngos].sort((a, b) => {
    const da =
      a.distanceKm ??
      distanceKm(reportLat, reportLng, a.latitude, a.longitude) ??
      Infinity
    const db =
      b.distanceKm ??
      distanceKm(reportLat, reportLng, b.latitude, b.longitude) ??
      Infinity
    if (da !== db) return da - db
    return (a.name || '').localeCompare(b.name || '')
  })
}

/** Approved rescue team (legacy accounts without approvalStatus count as approved) */
export function isApprovedRescueTeam(team) {
  const status = team?.approvalStatus ?? 'approved'
  return status === 'approved'
}

/** Free = approved and fewer than 2 active missions */
export function isAvailableRescueTeam(team) {
  return (
    isApprovedRescueTeam(team) &&
    !team?.isBusy &&
    (team?.activeAssignments ?? 0) < 2
  )
}

export function fuzzyMatch(query, text) {
  if (!query?.trim()) return true
  const haystack = (text || '').toLowerCase()
  const q = query.trim().toLowerCase()
  if (haystack.includes(q)) return true
  return q.split(/\s+/).filter(Boolean).every(word => haystack.includes(word))
}

export function mapsLink(lat, lng) {
  if (lat == null || lng == null) return null
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export const RESOURCE_CATEGORIES = [
  'Food',
  'Water',
  'Medicine',
  'Clothing',
  'Shelter',
  'Equipment',
  'Transport',
  'Other',
]

export function getResourceCategoryIcon(cat) {
  const icons = {
    Food: '🍚',
    Water: '💧',
    Medicine: '💊',
    Clothing: '👕',
    Shelter: '🏠',
    Equipment: '🔧',
    Transport: '🚛',
    Other: '📦',
  }
  return icons[cat] || '📦'
}

export function getResourceId(r) {
  return String(r?._id ?? r?.id ?? '')
}

export function getBriefingForTeam(report, teamId) {
  const id = String(teamId ?? '')
  return (report?.teamBriefings || []).find(
    b => String(b.team?._id ?? b.team?.id ?? b.team) === id
  )
}
