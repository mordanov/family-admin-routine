import React, { useCallback, useEffect, useState } from 'react'
import { getSystemDiskRam, getSystemVolumes, getSystemContainers, pruneDockerImages } from '../api/system'
import './SystemPanel.css'

function fmtBytes(b) {
  if (b == null) return '—'
  if (b < 1024) return b + ' B'
  if (b < 1024 ** 2) return (b / 1024).toFixed(1) + ' KB'
  if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(1) + ' MB'
  return (b / 1024 ** 3).toFixed(2) + ' GB'
}

function UsageBar({ percent, danger = 85, warning = 65 }) {
  const cls =
    percent >= danger ? 'bar-fill danger' :
    percent >= warning ? 'bar-fill warn' : 'bar-fill ok'
  return (
    <div className="bar-bg">
      <div className={cls} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  )
}

function Spinner({ size = 16 }) {
  return (
    <span
      className="sys-spinner"
      style={{ width: size, height: size, borderWidth: size > 14 ? 2 : 1.5 }}
    />
  )
}

function RefreshBtn({ loading, onClick }) {
  return (
    <button className="sys-refresh-btn" onClick={onClick} disabled={loading} title="Refresh">
      {loading ? <Spinner size={12} /> : '↻'}
    </button>
  )
}

function SectionHeader({ title, loading, onRefresh }) {
  return (
    <div className="sys-sub-header">
      <span className="sys-sub-title">{title}</span>
      <RefreshBtn loading={loading} onClick={onRefresh} />
    </div>
  )
}

function StatBox({ label, used, total, free, percent, loading }) {
  return (
    <div className="stat-box">
      <div className="stat-label">{label}</div>
      {loading ? (
        <div className="stat-skeleton-wrap">
          <div className="stat-skeleton bar-skeleton" />
          <div className="stat-skeleton text-skeleton short" />
          <div className="stat-skeleton text-skeleton" />
        </div>
      ) : (
        <>
          <UsageBar percent={percent} />
          <div className="stat-nums">
            <span className="stat-used">
              {fmtBytes(used)}{percent != null && <span className="stat-pct"> ({percent}%)</span>}
            </span>
            <span className="stat-free">free {fmtBytes(free)}</span>
          </div>
          <div className="stat-total">total {fmtBytes(total)}</div>
        </>
      )}
    </div>
  )
}

function useSection(fetcher, autoRefreshMs = null) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const result = await fetcher()
      setData(result)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [fetcher])

  useEffect(() => {
    load()
    if (autoRefreshMs) {
      const id = setInterval(load, autoRefreshMs)
      return () => clearInterval(id)
    }
  }, [load, autoRefreshMs])

  return { data, loading, error, refresh: load }
}

export default function SystemPanel({ t }) {
  const diskRam = useSection(getSystemDiskRam, 60_000)
  const volumes = useSection(getSystemVolumes, 120_000)
  const containers = useSection(getSystemContainers, 30_000)

  const [pruneState, setPruneState] = useState({ loading: false, result: null, error: null })

  const handlePrune = async () => {
    setPruneState({ loading: true, result: null, error: null })
    try {
      const data = await pruneDockerImages()
      const size = fmtBytes(data.reclaimed_bytes)
      setPruneState({ loading: false, result: t('sysPruneResult', data.deleted_count, size), error: null })
      containers.refresh()
    } catch (err) {
      setPruneState({ loading: false, result: null, error: t('sysPruneError') + (err.response?.data?.detail ?? err.message) })
    }
  }

  const disk = diskRam.data?.disk || {}
  const ram  = diskRam.data?.ram  || {}
  const vols = volumes.data?.volumes || {}
  const ctrs = containers.data?.containers || []

  const isFirstDiskRam   = diskRam.loading && !diskRam.data
  const isFirstVolumes   = volumes.loading && !volumes.data
  const isFirstContainers = containers.loading && !containers.data

  return (
    <section className="section sys-panel">
      <h2 className="section-title">{t('sysTitle')}</h2>

      {/* ── Disk + RAM ── */}
      <SectionHeader
        title={t('sysDiskRam')}
        loading={diskRam.loading}
        onRefresh={diskRam.refresh}
      />
      <div className="sys-stats-row">
        <StatBox
          label={t('sysDisk')}
          used={disk.used_bytes}
          total={disk.total_bytes}
          free={disk.free_bytes}
          percent={disk.used_percent}
          loading={isFirstDiskRam}
        />
        <StatBox
          label={t('sysRam')}
          used={ram.used_bytes}
          total={ram.total_bytes}
          free={ram.available_bytes}
          percent={ram.used_percent}
          loading={isFirstDiskRam}
        />
      </div>

      {/* ── Volumes ── */}
      <SectionHeader
        title={t('sysVolumes')}
        loading={volumes.loading}
        onRefresh={volumes.refresh}
      />
      {isFirstVolumes ? (
        <div className="sys-loading-block"><Spinner size={20} /></div>
      ) : Object.keys(vols).length === 0 ? (
        <div className="sys-empty">{t('sysNoData')}</div>
      ) : (
        <div className="vol-grid">
          {Object.entries(vols).map(([label, vol]) => (
            <div key={label} className="vol-card">
              <div className="vol-name">{label}</div>
              <div className="vol-size">{fmtBytes(vol.size_bytes)}</div>
              <div className="vol-path">{vol.path}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Containers ── */}
      <div className="sys-sub-header">
        <span className="sys-sub-title">{t('sysContainers')}</span>
        <div className="sys-sub-actions">
          <button
            className="sys-prune-btn"
            onClick={handlePrune}
            disabled={pruneState.loading}
            title="docker image prune -a -f"
          >
            {pruneState.loading ? <><Spinner size={12} /> {t('sysPruneRunning')}</> : t('sysPruneBtn')}
          </button>
          <RefreshBtn loading={containers.loading} onClick={containers.refresh} />
        </div>
      </div>
      {pruneState.result && (
        <div className="prune-result prune-ok" onClick={() => setPruneState(s => ({ ...s, result: null }))}>
          {pruneState.result}
        </div>
      )}
      {pruneState.error && (
        <div className="prune-result prune-err" onClick={() => setPruneState(s => ({ ...s, error: null }))}>
          {pruneState.error}
        </div>
      )}
      {isFirstContainers ? (
        <div className="sys-loading-block"><Spinner size={20} /></div>
      ) : ctrs.length === 0 ? (
        <div className="sys-empty">{t('sysNoDocker')}</div>
      ) : (
        <div className="table-wrap">
          <table className="sys-table">
            <thead>
              <tr>
                <th>{t('sysContainerName')}</th>
                <th>{t('sysContainerStatus')}</th>
                <th>{t('sysContainerRss')}</th>
                <th>{t('sysContainerLimit')}</th>
                <th>{t('sysContainerPct')}</th>
              </tr>
            </thead>
            <tbody>
              {ctrs.map((c) => (
                <tr key={c.name}>
                  <td className="td-mono">{c.name}</td>
                  <td>
                    <span className={`status-badge ${c.status === 'running' ? 'status-ok' : 'status-warn'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>{fmtBytes(c.rss_bytes)}</td>
                  <td>{fmtBytes(c.limit_bytes)}</td>
                  <td>
                    <div className="inline-bar-wrap">
                      <UsageBar percent={c.used_percent} />
                      <span className="inline-pct">{c.used_percent}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
