import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useLangStore } from '../store/langStore'
import { useT } from '../i18n'
import { login } from '../api/auth'
import './Login.css'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('remember_me') === 'true')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login: storeLogin } = useAuthStore()
  const { lang, setLang } = useLangStore()
  const navigate = useNavigate()
  const t = useT()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    localStorage.setItem('remember_me', String(rememberMe))
    try {
      const data = await login(username, password, rememberMe)
      storeLogin(data.access_token, username, rememberMe)
      navigate('/')
    } catch {
      setError(t('invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="lang-toggle login-lang">
        <button
          className={lang === 'en' ? 'lang-btn active' : 'lang-btn'}
          onClick={() => setLang('en')}
        >EN</button>
        <button
          className={lang === 'ru' ? 'lang-btn active' : 'lang-btn'}
          onClick={() => setLang('ru')}
        >RU</button>
      </div>
      <div className="login-card">
        <div className="login-icon">🛡️</div>
        <h1 className="login-title">{t('appName')}</h1>
        <p className="login-subtitle">{t('backupManagement')}</p>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label htmlFor="username">{t('username')}</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t('password')}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="login-error">{error}</p>}
          <label className="login-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>{t('rememberMe')}</span>
          </label>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? t('signingIn') : t('signIn')}
          </button>
        </form>
      </div>
    </div>
  )
}
