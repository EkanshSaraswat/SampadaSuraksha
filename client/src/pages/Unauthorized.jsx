import { Link } from 'react-router-dom'

export default function Unauthorized() {
  return (
    <div className="unauth-page">
      <div className="unauth-icon">🚫</div>
      <h1>Access Denied</h1>
      <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px' }}>
        You are not authorized to view this page. Please log in with an account that has the required permissions.
      </p>
      <Link to="/login" className="btn btn-primary" style={{ width: 'auto', marginTop: '0.5rem' }}>
        Back to Login
      </Link>
    </div>
  )
}
