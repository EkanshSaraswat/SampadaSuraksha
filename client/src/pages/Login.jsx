import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const ROLE_ROUTES = {
  Victim: '/victim/dashboard',
  RescueTeam: '/rescue/dashboard',
  NGO: '/ngo/dashboard',
  Admin: '/admin/dashboard',
  ResourceProvider: '/resource/dashboard',
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await axios.post('http://localhost:5000/api/auth/login', {
        email: form.email.trim(),
        password: form.password,
      })

      const { token, user } = data
      login(token, user)

      const route = ROLE_ROUTES[user.role] || '/login'
      navigate(route, { replace: true })
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Login failed. Please check your credentials.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="card">
        {/* Branding */}
        <div className="brand">
          <div className="brand-icon">🛡️</div>
          <div className="brand-title">SampadaSuraksha</div>
          <div className="brand-subtitle">Disaster Relief Coordination Platform</div>
        </div>

        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Sign In</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: '0.5rem' }}
          >
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>

        <div className="divider" style={{ margin: '1.5rem 0' }}>or</div>

        <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-link">Create one</Link>
        </p>
      </div>
    </div>
  )
}
