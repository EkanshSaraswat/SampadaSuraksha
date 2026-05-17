import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

const ROLES = ['Victim', 'RescueTeam', 'NGO', 'Admin', 'ResourceProvider']

export default function Register() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
    city: '',
    state: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.role) {
      setError('Please select a role.')
      return
    }

    setLoading(true)

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      }
      if (form.role === 'NGO' || form.role === 'ResourceProvider') {
        payload.city = form.city.trim()
        payload.state = form.state.trim()
      }

      const { data } = await axios.post('/api/auth/register', payload)

      if (data.pendingApproval) {
        setSuccess(
          data.message ||
            'Registration received. An admin must approve your rescue team account before you can sign in.'
        )
        return
      }

      setSuccess('Account created! Redirecting to login…')
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Registration failed. Please try again.'
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
          <div className="brand-subtitle">Create your account</div>
        </div>

        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Register</h2>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="reg-name">Full Name</label>
            <input
              id="reg-name"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Your full name"
              required
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Email Address</label>
            <input
              id="reg-email"
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
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Min. 6 characters"
              required
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-role">Your Role</label>
            <select
              id="reg-role"
              name="role"
              value={form.role}
              onChange={handleChange}
              required
            >
              <option value="" disabled>Select a role…</option>
              {ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {(form.role === 'NGO' || form.role === 'ResourceProvider') && (
            <>
              <div className="form-group">
                <label htmlFor="reg-city">City / district</label>
                <input
                  id="reg-city"
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="e.g. Mumbai"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="reg-state">State</label>
                <input
                  id="reg-state"
                  type="text"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  placeholder="e.g. Maharashtra"
                  required
                />
              </div>
            </>
          )}

          <button
            id="register-submit-btn"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: '0.5rem' }}
          >
            {loading ? <span className="spinner" /> : 'Create Account'}
          </button>
        </form>

        <div className="divider" style={{ margin: '1.5rem 0' }}>or</div>

        <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" className="text-link">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
