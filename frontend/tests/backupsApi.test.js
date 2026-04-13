/**
 * Tests for src/api/backups.js and src/api/auth.js
 * The axios instance (src/api/index.js) is mocked in setup.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '../src/api/index.js'

import {
  getSites,
  getBackups,
  createBackup,
  getJobStatus,
  restoreBackup,
  deleteBackup,
  downloadBackup,
} from '../src/api/backups'

import { login, getMe } from '../src/api/auth'

beforeEach(() => vi.clearAllMocks())

// ── backups.js ────────────────────────────────────────────────────────────────

describe('getSites', () => {
  it('calls GET /sites and returns data', async () => {
    const sites = [{ name: 'reminders-app', volumes: [], last_backup: null }]
    api.get.mockResolvedValue({ data: sites })
    const result = await getSites()
    expect(api.get).toHaveBeenCalledWith('/sites')
    expect(result).toEqual(sites)
  })
})

describe('getBackups', () => {
  it('calls GET /backups and returns data', async () => {
    const backups = [{ filename: 'x.zip', site: 'news-site', size_bytes: 100, created_at: '2026-01-01T00:00:00' }]
    api.get.mockResolvedValue({ data: backups })
    const result = await getBackups()
    expect(api.get).toHaveBeenCalledWith('/backups')
    expect(result).toEqual(backups)
  })
})

describe('createBackup', () => {
  it('posts to /backups/create with site name', async () => {
    api.post.mockResolvedValue({ data: { job_id: 'abc' } })
    const result = await createBackup('poetry-site')
    expect(api.post).toHaveBeenCalledWith('/backups/create', { site: 'poetry-site' })
    expect(result).toEqual({ job_id: 'abc' })
  })
})

describe('getJobStatus', () => {
  it('calls GET /backups/status/{jobId}', async () => {
    api.get.mockResolvedValue({ data: { status: 'done', message: 'ok' } })
    const result = await getJobStatus('job-xyz')
    expect(api.get).toHaveBeenCalledWith('/backups/status/job-xyz')
    expect(result.status).toBe('done')
  })
})

describe('restoreBackup', () => {
  it('posts to /backups/{filename}/restore', async () => {
    api.post.mockResolvedValue({ data: { job_id: 'restore-1' } })
    const result = await restoreBackup('site_20260101_120000.zip')
    expect(api.post).toHaveBeenCalledWith(
      `/backups/${encodeURIComponent('site_20260101_120000.zip')}/restore`
    )
    expect(result.job_id).toBe('restore-1')
  })
})

describe('deleteBackup', () => {
  it('calls DELETE /backups/{filename}', async () => {
    api.delete.mockResolvedValue({ data: { ok: true } })
    const result = await deleteBackup('site_20260101_120000.zip')
    expect(api.delete).toHaveBeenCalledWith(
      `/backups/${encodeURIComponent('site_20260101_120000.zip')}`
    )
    expect(result).toEqual({ ok: true })
  })
})

describe('downloadBackup', () => {
  it('calls GET with responseType blob and the correct URL', async () => {
    const blob = new Blob(['data'], { type: 'application/zip' })
    api.get.mockResolvedValue({ data: blob })
    const objectUrl = 'blob:http://localhost/fake'
    URL.createObjectURL = vi.fn().mockReturnValue(objectUrl)
    URL.revokeObjectURL = vi.fn()
    const clickMock = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue({ href: '', download: '', click: clickMock })

    await downloadBackup('news-site_20260101_120000.zip')

    expect(api.get).toHaveBeenCalledWith(
      `/backups/${encodeURIComponent('news-site_20260101_120000.zip')}/download`,
      { responseType: 'blob' }
    )
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(clickMock).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(objectUrl)
  })

  it('encodes special characters in filename', async () => {
    const blob = new Blob(['data'], { type: 'application/zip' })
    api.get.mockResolvedValue({ data: blob })
    URL.createObjectURL = vi.fn().mockReturnValue('blob:fake')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue({ href: '', download: '', click: vi.fn() })

    await downloadBackup('my site_2026.zip')

    expect(api.get).toHaveBeenCalledWith(
      `/backups/${encodeURIComponent('my site_2026.zip')}/download`,
      { responseType: 'blob' }
    )
  })
})

// ── auth.js ───────────────────────────────────────────────────────────────────

describe('login', () => {
  it('posts form-encoded credentials and returns data', async () => {
    api.post.mockResolvedValue({ data: { access_token: 'tok', token_type: 'bearer' } })
    const result = await login('admin1', 'pass1')
    expect(api.post).toHaveBeenCalledWith(
      '/auth/login',
      expect.any(URLSearchParams),
      expect.objectContaining({ headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    )
    expect(result.access_token).toBe('tok')
  })

  it('includes username and password in the form body', async () => {
    api.post.mockResolvedValue({ data: { access_token: 'tok', token_type: 'bearer' } })
    await login('admin2', 'secret')
    const formBody = api.post.mock.calls[0][1]
    expect(formBody.get('username')).toBe('admin2')
    expect(formBody.get('password')).toBe('secret')
  })
})

describe('getMe', () => {
  it('calls GET /auth/me and returns data', async () => {
    api.get.mockResolvedValue({ data: { username: 'admin1' } })
    const result = await getMe()
    expect(api.get).toHaveBeenCalledWith('/auth/me')
    expect(result.username).toBe('admin1')
  })
})
