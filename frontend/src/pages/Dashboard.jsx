import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  createBackup,
  deleteBackup,
  downloadUrl,
  getBackups,
  getJobStatus,
  getSites,
  restoreBackup,
} from '../api/backups'
import './Dashboard.css'

const SITE_LABELS = {
  'family-kitchen-recipes': '🍳 Recipes',
  'poetry-site': '📝 Poetry',
  'news-site': '📰 News',
  'budget-site': '💰 Budget',
  'reminders-app': '🔔 Reminders',
}

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
  const navigate = useNavigate()

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
        [job_id]: { status: 'pending', message: 'Queued…', site: siteName },
      }))
      pollJob(job_id)
    } catch (err) {
      alert('Failed to start backup: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleRestore = async (filename) => {
    if (!confirm(`Restore from "${filename}"?\nThis will OVERWRITE the current database and files.`)) return
    try {
      const { job_id } = await restoreBackup(filename)
      setJobs((prev) => ({
        ...prev,
        [job_id]: { status: 'pending', message: 'Queued…', filename },
      }))
      pollJob(job_id)
    } catch (err) {
      alert('Failed to start restore: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleDelete = async (filename) => {
    if (!confirm(`Delete backup "${filename}"?`)) return
    try {
      await deleteBackup(filename)
      await loadAll()
    } catch (err) {
      alert('Failed to delete: ' + (err.response?.data?.detail || err.message))
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

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="header-logo">🛡️</span>
          <span className="header-title">Admin Routine</span>
        </div>
        <div className="header-right">
          <span className="header-user">👤 {username}</span>
          <button className="btn-logout" onClick={handleLogout}>Sign out</button>
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
          <h2 className="section-title">Sites</h2>
          <div className="sites-grid">
            {sites.map((site) => (
              <div key={site.name} className="site-card">
                <div className="site-name">
                  {SITE_LABELS[site.name] || site.name}
                </div>
                <div className="site-meta">
                  {site.volumes.length > 0
                    ? `Volumes: ${site.volumes.join(', ')}`
                    : 'DB only'}
                </div>
                <div className="site-last">
                  Last backup: {fmtDate(site.last_backup)}
                </div>
                <button
                  className="btn-backup"
                  onClick={() => handleBackup(site.name)}
                  disabled={siteHasJob(site.name)}
                >
                  {siteHasJob(site.name) ? (
                    <><span className="spinner-sm" /> Running…</>
                  ) : (
                    '+ Create Backup'
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Backups section */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Backups</h2>
            <div className="filter-row">
              <label htmlFor="filter-site">Filter:</label>
              <select
                id="filter-site"
                value={filterSite}
                onChange={(e) => setFilterSite(e.target.value)}
              >
                <option value="all">All sites</option>
                {sites.map((s) => (
                  <option key={s.name} value={s.name}>
                    {SITE_LABELS[s.name] || s.name}
                  </option>
                ))}
              </select>
              <button className="btn-refresh" onClick={loadAll} title="Refresh">↻</button>
            </div>
          </div>

          {filteredBackups.length === 0 ? (
            <div className="empty-state">No backups yet. Create one above.</div>
          ) : (
            <div className="table-wrap">
              <table className="backups-table">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Site</th>
                    <th>Size</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBackups.map((b) => (
                    <tr key={b.filename}>
                      <td className="td-filename">{b.filename}</td>
                      <td>
                        <span className="badge">
                          {SITE_LABELS[b.site] || b.site}
                        </span>
                      </td>
                      <td>{fmtBytes(b.size_bytes)}</td>
                      <td>{fmtDate(b.created_at)}</td>
                      <td className="td-actions">
                        <a
                          href={downloadUrl(b.filename)}
                          className="btn-action btn-download"
                          download
                        >
                          ↓ Download
                        </a>
                        <button
                          className="btn-action btn-restore"
                          onClick={() => handleRestore(b.filename)}
                        >
                          ↺ Restore
                        </button>
                        <button
                          className="btn-action btn-delete"
                          onClick={() => handleDelete(b.filename)}
                        >
                          🗑 Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
