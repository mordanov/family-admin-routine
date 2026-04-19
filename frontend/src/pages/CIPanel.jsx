import React, { useCallback, useEffect, useState } from 'react'
import { getCiRuns } from '../api/ci'
import { SITE_LABEL_KEYS } from '../i18n'
import './CIPanel.css'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(s) {
  if (s == null) return '—'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const sec = s % 60
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`
}

function fmtAgo(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function conclusionClass(status, conclusion) {
  if (status === 'in_progress' || status === 'queued') return 'ci-running'
  if (conclusion === 'success') return 'ci-ok'
  if (conclusion === 'failure' || conclusion === 'timed_out') return 'ci-fail'
  return 'ci-neutral'
}

function conclusionLabel(status, conclusion) {
  if (status === 'in_progress') return '⟳ running'
  if (status === 'queued') return '◌ queued'
  if (conclusion === 'success') return '✓ success'
  if (conclusion === 'failure') return '✕ failure'
  if (conclusion === 'timed_out') return '✕ timed out'
  if (conclusion === 'cancelled') return '◌ cancelled'
  if (conclusion === 'skipped') return '— skipped'
  return conclusion || status || '?'
}

function siteSummaryClass(runs) {
  if (!runs.length) return 'ci-neutral'
  const latest = runs[0]
  return conclusionClass(latest.status, latest.conclusion)
}

// ── sub-components ────────────────────────────────────────────────────────────

function Spinner({ size = 16 }) {
  return (
    <span
      className="ci-spinner"
      style={{ width: size, height: size, borderWidth: size > 14 ? 2 : 1.5 }}
    />
  )
}

function RefreshBtn({ loading, onClick }) {
  return (
    <button className="ci-refresh-btn" onClick={onClick} disabled={loading} title="Refresh">
      {loading ? <Spinner size={12} /> : '↻'}
    </button>
  )
}

// ── main component ────────────────────────────────────────────────────────────

function useSection(fetcher, autoRefreshMs) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setData(await fetcher())
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

export default function CIPanel({ t }) {
  const ci = useSection(getCiRuns, 60_000)
  const isFirst = ci.loading && !ci.data

  return (
    <section className="section ci-panel">
      <div className="ci-header">
        <h2 className="section-title">{t('ciTitle')}</h2>
        <RefreshBtn loading={ci.loading} onClick={ci.refresh} />
      </div>

      {isFirst ? (
        <div className="ci-loading"><Spinner size={20} /></div>
      ) : ci.error ? (
        <div className="ci-notice ci-notice-err">Failed to load CI data.</div>
      ) : !ci.data?.configured ? (
        <div className="ci-notice">{t('ciNotConfigured')}</div>
      ) : (
        Object.entries(ci.data.sites).map(([siteSlug, { repo, runs }]) => {
          const labelKey = SITE_LABEL_KEYS[siteSlug]
          const siteLabel = labelKey ? t(labelKey) : siteSlug
          const summaryClass = siteSummaryClass(runs)
          return (
            <div key={siteSlug} className="ci-site-block">
              <div className="ci-site-header">
                <span className="ci-site-name">{siteLabel}</span>
                <span className="ci-repo-name">{repo}</span>
                <span className={`ci-dot ${summaryClass}`} />
              </div>
              {runs.length === 0 ? (
                <div className="ci-empty">{t('ciNoRuns')}</div>
              ) : (
                <div className="table-wrap">
                  <table className="ci-table">
                    <thead>
                      <tr>
                        <th>{t('ciWorkflow')}</th>
                        <th>{t('ciEvent')}</th>
                        <th>{t('ciStatus')}</th>
                        <th>{t('ciDuration')}</th>
                        <th>{t('ciTimestamp')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((run) => (
                        <tr
                          key={run.id}
                          className="ci-run-row"
                          onClick={() => window.open(run.url, '_blank', 'noopener,noreferrer')}
                          title={`#${run.run_number} — open in GitHub`}
                        >
                          <td className="td-workflow">
                            <span className="run-name">{run.name}</span>
                            {run.branch && <span className="run-branch">{run.branch}</span>}
                          </td>
                          <td className="td-event">{run.event}</td>
                          <td>
                            <span className={`ci-badge ${conclusionClass(run.status, run.conclusion)}`}>
                              {conclusionLabel(run.status, run.conclusion)}
                            </span>
                          </td>
                          <td className="td-mono">{fmtDuration(run.duration_s)}</td>
                          <td className="td-ago">{fmtAgo(run.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })
      )}
    </section>
  )
}
