import React from 'react'
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

function StatBox({ label, used, total, free, percent, loading }) {
  return (
    <div className="stat-box">
      <div className="stat-label">{label}</div>
      {loading ? (
        <div className="stat-loading">…</div>
      ) : (
        <>
          <UsageBar percent={percent} />
          <div className="stat-nums">
            <span className="stat-used">{fmtBytes(used)} {percent != null && <span className="stat-pct">({percent}%)</span>}</span>
            <span className="stat-free">free {fmtBytes(free)}</span>
          </div>
          <div className="stat-total">total {fmtBytes(total)}</div>
        </>
      )}
    </div>
  )
}

export default function SystemPanel({ data, loading, t }) {
  const disk = data?.disk || {}
  const ram = data?.ram || {}
  const volumes = data?.volumes || {}
  const containers = data?.containers || []

  return (
    <section className="section sys-panel">
      <h2 className="section-title">{t('sysTitle')}</h2>

      {/* Disk + RAM */}
      <div className="sys-stats-row">
        <StatBox
          label={t('sysDisk')}
          used={disk.used_bytes}
          total={disk.total_bytes}
          free={disk.free_bytes}
          percent={disk.used_percent}
          loading={loading}
        />
        <StatBox
          label={t('sysRam')}
          used={ram.used_bytes}
          total={ram.total_bytes}
          free={ram.available_bytes}
          percent={ram.used_percent}
          loading={loading}
        />
      </div>

      {/* Volumes */}
      <div className="sys-sub-title">{t('sysVolumes')}</div>
      {loading ? (
        <div className="sys-loading">…</div>
      ) : Object.keys(volumes).length === 0 ? (
        <div className="sys-empty">{t('sysNoData')}</div>
      ) : (
        <div className="vol-grid">
          {Object.entries(volumes).map(([label, vol]) => (
            <div key={label} className="vol-card">
              <div className="vol-name">{label}</div>
              <div className="vol-size">
                {vol.size_bytes != null ? fmtBytes(vol.size_bytes) : '—'}
              </div>
              <div className="vol-path">{vol.path}</div>
            </div>
          ))}
        </div>
      )}

      {/* Containers */}
      <div className="sys-sub-title">{t('sysContainers')}</div>
      {loading ? (
        <div className="sys-loading">…</div>
      ) : containers.length === 0 ? (
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
              {containers.map((c) => (
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

