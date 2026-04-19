import React, { useCallback, useEffect, useState } from 'react'
import { getCiRuns } from '../api/ci'
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

function repoSummaryClass(runs) {
  if (!runs.length) return 'ci-neutral'
  return conclusionClass(runs[0].status, runs[0].conclusion)
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

// ── hook ──────────────────────────────────────────────────────────────────────

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

// ── main component ────────────────────────────────────────────────────────────

export default function CIPanel({ t }) {
  const ci = useSection(getCiRuns, 60_000)
  const [activeTab, setActiveTab] = useState(0)
  const isFirst = ci.loading && !ci.data

  const repos = ci.data?.repos ?? []
  const activeRepo = repos[activeTab] ?? repos[0]

  // keep activeTab in bounds when repos list changes
  useEffect(() => {
    if (activeTab >= repos.length && repos.length > 0) setActiveTab(0)
  }, [repos.length, activeTab])

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
      ) : repos.length === 0 ? (
        <div className="ci-notice">{t('ciNoRepos')}</div>
      ) : (
        <>
          {/* ── Tab bar ── */}
          <div className="ci-tabs">
            {repos.map(({ key, label, runs }, idx) => (
              <button
                key={key}
                className={`ci-tab ${idx === activeTab ? 'ci-tab-active' : ''}`}
                onClick={() => setActiveTab(idx)}
              >
                <span className={`ci-tab-dot ${repoSummaryClass(runs)}`} />
                {label}
              </button>
            ))}
          </div>

          {/* ── Active repo pane ── */}
          {activeRepo && (
            <div className="ci-pane">
              <div className="ci-pane-meta">
                <span className="ci-repo-name">{activeRepo.repo}</span>
              </div>
              {activeRepo.runs.length === 0 ? (
                <div className="ci-empty">{t('ciNoRuns')}</div>
              ) : (
                <div className="table-wrap">
                  <table className="ci-table">
                    <thead>
                      <tr>
                        <th>{t('ciWorkflow')}</th>
                        <th>{t('ciCommit')}</th>
                        <th>{t('ciStatus')}</th>
                        <th>{t('ciDuration')}</th>
                        <th>{t('ciTimestamp')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRepo.runs.map((run) => (
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
                          <td className="td-commit">
                            {run.commit_message
                              ? <span className="commit-msg">{run.commit_message}</span>
                              : <span className="commit-sha">{run.commit_sha}</span>
                            }
                          </td>
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
          )}
        </>
      )}
    </section>
  )
}
