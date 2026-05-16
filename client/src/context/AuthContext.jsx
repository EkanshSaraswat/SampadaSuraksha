import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('ss_token') || null)
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('ss_user')
    return stored ? JSON.parse(stored) : null
  })

  function login(newToken, newUser) {
    setToken(newToken)
    setUser(newUser)
    localStorage.setItem('ss_token', newToken)
    localStorage.setItem('ss_user', JSON.stringify(newUser))
  }

  function logout() {
    setToken(null)
    setUser(null)
    localStorage.removeItem('ss_token')
    localStorage.removeItem('ss_user')
  }

  const isAuthenticated = !!token && !!user

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
