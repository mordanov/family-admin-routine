import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useLangStore } from '../store/langStore'
import { useT, SITE_LABEL_KEYS } from '../i18n'
import {
  createBackup,
  deleteBackup,
  downloadBackup,
  getBackups,
  getJobStatus,
  getSites,
  restoreBackup,
} from '../api/backups'
import SystemPanel from './SystemPanel'
import CIPanel from './CIPanel'
import './Dashboard.css'

function fmtBytes(b) {
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1024 / 1024).toFixed(1) + ' MB'
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

export default function DashboardPage() {
  const { username, logout } = useAuthStore()
  const { lang, setLang } = useLangStore()
  const navigate = useNavigate()
  const t = useT()

  const [sites, setSites] = useState([])
  const [backups, setBackups] = useState([])
  const [filterSite, setFilterSite] = useState('all')
  const [jobs, setJobs] = useState({}) // jobId -> job info
  const pollRef = useRef({})

  const loadAll = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([getSites(), getBackups()])
      setSites(s)
      setBackups(b)
    } catch {
      // silently ignore on background refresh
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Poll a job until done/failed
  const pollJob = useCallback(
    (jobId) => {
      if (pollRef.current[jobId]) return
      pollRef.current[jobId] = setInterval(async () => {
        try {
          const status = await getJobStatus(jobId)
          setJobs((prev) => ({ ...prev, [jobId]: status }))
          if (status.status === 'done' || status.status === 'failed') {
            clearInterval(pollRef.current[jobId])
            delete pollRef.current[jobId]
            await loadAll()
          }
        } catch {
          clearInterval(pollRef.current[jobId])
          delete pollRef.current[jobId]
        }
      }, 2000)
    },
    [loadAll]
  )

  useEffect(
    () => () => Object.values(pollRef.current).forEach(clearInterval),
    []
  )

  const handleBackup = async (siteName) => {
    try {
      const { job_id } = await createBackup(siteName)
      setJobs((prev) => ({
        ...prev,
        [job_id]: { status: 'pending', message: t('queued'), site: siteName },
      }))
      pollJob(job_id)
    } catch (err) {
      alert(t('failedBackup') + (err.response?.data?.detail || err.message))
    }
  }

  const handleRestore = async (filename) => {
    if (!confirm(t('confirmRestore', filename))) return
    try {
      const { job_id } = await restoreBackup(filename)
      setJobs((prev) => ({
        ...prev,
        [job_id]: { status: 'pending', message: t('queued'), filename },
      }))
      pollJob(job_id)
    } catch (err) {
      alert(t('failedRestore') + (err.response?.data?.detail || err.message))
    }
  }

  const handleDelete = async (filename) => {
    if (!confirm(t('confirmDelete', filename))) return
    try {
      await deleteBackup(filename)
      await loadAll()
    } catch (err) {
      alert(t('failedDelete') + (err.response?.data?.detail || err.message))
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Active jobs notification bar
  const activeJobs = Object.entries(jobs).filter(
    ([, j]) => j.status === 'running' || j.status === 'pending'
  )

  const filteredBackups =
    filterSite === 'all' ? backups : backups.filter((b) => b.site === filterSite)

  // Per-site active job indicator
  const siteHasJob = (siteName) =>
    Object.values(jobs).some(
      (j) => j.site === siteName && (j.status === 'running' || j.status === 'pending')
    )

  const siteLabel = (name) => t(SITE_LABEL_KEYS[name] || name)

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="header-logo">🛡️</span>
          <span className="header-title">{t('appName')}</span>
        </div>
        <div className="header-right">
          <div className="lang-toggle">
            <button
              className={lang === 'en' ? 'lang-btn active' : 'lang-btn'}
              onClick={() => setLang('en')}
            >EN</button>
            <button
              className={lang === 'ru' ? 'lang-btn active' : 'lang-btn'}
              onClick={() => setLang('ru')}
            >RU</button>
          </div>
          <span className="header-user">👤 {username}</span>
          <button className="btn-logout" onClick={handleLogout}>{t('signOut')}</button>
        </div>
      </header>

      <main className="main">
        {/* Active jobs bar */}
        {activeJobs.length > 0 && (
          <div className="jobs-bar">
            {activeJobs.map(([id, j]) => (
              <div key={id} className="job-item">
                <span className="spinner" />
                <span>{j.site || j.filename} — {j.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Failed jobs */}
        {Object.entries(jobs)
          .filter(([, j]) => j.status === 'failed')
          .map(([id, j]) => (
            <div key={id} className="job-error">
              ❌ <strong>{j.site || j.filename}</strong>: {j.message}
              <button
                className="btn-dismiss"
                onClick={() => setJobs((p) => { const n = { ...p }; delete n[id]; return n })}
              >✕</button>
            </div>
          ))}

        {/* Done jobs */}
        {Object.entries(jobs)
          .filter(([, j]) => j.status === 'done')
          .map(([id, j]) => (
            <div key={id} className="job-success">
              ✅ <strong>{j.site || j.filename}</strong>: {j.message}
              <button
                className="btn-dismiss"
                onClick={() => setJobs((p) => { const n = { ...p }; delete n[id]; return n })}
              >✕</button>
            </div>
          ))}

        {/* Sites section */}
        <section className="section">
          <h2 className="section-title">{t('sites')}</h2>
          <div className="sites-grid">
            {sites.map((site) => (
              <div key={site.name} className="site-card">
                <div className="site-name">
                  {siteLabel(site.name)}
                </div>
                <div className="site-meta">
                  {site.volumes.length > 0
                    ? `${t('volumes')} ${site.volumes.join(', ')}`
                    : t('dbOnly')}
                </div>
                <div className="site-last">
                  {t('lastBackup')} {fmtDate(site.last_backup)}
                </div>
                <button
                  className="btn-backup"
                  onClick={() => handleBackup(site.name)}
                  disabled={siteHasJob(site.name)}
                >
                  {siteHasJob(site.name) ? (
                    <><span className="spinner-sm" /> {t('running')}</>
                  ) : (
                    t('createBackup')
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Backups section */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">{t('backups')}</h2>
            <div className="filter-row">
              <label htmlFor="filter-site">{t('filter')}</label>
              <select
                id="filter-site"
                value={filterSite}
                onChange={(e) => setFilterSite(e.target.value)}
              >
                <option value="all">{t('allSites')}</option>
                {sites.map((s) => (
                  <option key={s.name} value={s.name}>
                    {siteLabel(s.name)}
                  </option>
                ))}
              </select>
              <button className="btn-refresh" onClick={loadAll} title="Refresh">↻</button>
            </div>
          </div>

          {filteredBackups.length === 0 ? (
            <div className="empty-state">{t('noBackups')}</div>
          ) : (
            <div className="table-wrap">
              <table className="backups-table">
                <thead>
                  <tr>
                    <th>{t('colFilename')}</th>
                    <th>{t('colSite')}</th>
                    <th>{t('colSize')}</th>
                    <th>{t('colCreated')}</th>
                    <th>{t('colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBackups.map((b) => (
                    <tr key={b.filename}>
                      <td className="td-filename">{b.filename}</td>
                      <td>
                        <span className="badge">
                          {siteLabel(b.site)}
                        </span>
                      </td>
                      <td>{fmtBytes(b.size_bytes)}</td>
                      <td>{fmtDate(b.created_at)}</td>
                      <td className="td-actions">
                        <button
                          className="btn-action btn-download"
                          onClick={() => downloadBackup(b.filename)}
                        >
                          {t('download')}
                        </button>
                        <button
                          className="btn-action btn-restore"
                          onClick={() => handleRestore(b.filename)}
                        >
                          {t('restore')}
                        </button>
                        <button
                          className="btn-action btn-delete"
                          onClick={() => handleDelete(b.filename)}
                        >
                          {t('delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* System info */}
        <SystemPanel t={t} />

        {/* CI / Deployments */}
        <CIPanel t={t} />
      </main>
    </div>
  )
}
