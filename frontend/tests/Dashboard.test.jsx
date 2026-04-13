import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '../src/pages/Dashboard'
import { useAuthStore } from '../src/store/authStore'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../src/store/authStore', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('../src/api/backups', () => ({
  getSites:      vi.fn(),
  getBackups:    vi.fn(),
  createBackup:  vi.fn(),
  getJobStatus:  vi.fn(),
  restoreBackup: vi.fn(),
  deleteBackup:  vi.fn(),
  downloadBackup: vi.fn(),
}))

import {
  getSites,
  getBackups,
  createBackup,
  deleteBackup,
  getJobStatus,
} from '../src/api/backups'

const MOCK_SITES = [
  { name: 'reminders-app',  volumes: [],           last_backup: null },
  { name: 'poetry-site',    volumes: ['uploads'],   last_backup: '2026-01-15T10:00:00' },
  { name: 'news-site',      volumes: ['photos'],    last_backup: null },
  { name: 'budget-site',    volumes: ['uploads'],   last_backup: null },
  { name: 'family-kitchen-recipes', volumes: ['uploads', 'documents'], last_backup: null },
]

const MOCK_BACKUPS = [
  { filename: 'reminders-app_20260101_120000.zip', site: 'reminders-app', size_bytes: 2048, created_at: '2026-01-01T12:00:00' },
  { filename: 'poetry-site_20260115_100000.zip',   site: 'poetry-site',   size_bytes: 51200, created_at: '2026-01-15T10:00:00' },
]

const mockLogout = vi.fn()

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  )

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.mockReturnValue({ username: 'admin1', logout: mockLogout })
    getSites.mockResolvedValue(MOCK_SITES)
    getBackups.mockResolvedValue(MOCK_BACKUPS)
  })

  // ── Initial render ─────────────────────────────────────────────────────────

  it('shows the app title in the header', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText(/admin routine/i)).toBeInTheDocument())
  })

  it('shows the logged-in username', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText(/admin1/i)).toBeInTheDocument())
  })

  it('renders a site card for each site', async () => {
    renderDashboard()
    // Use getAllByText — site names appear in the card, filter dropdown, and badge
    await waitFor(() => {
      expect(screen.getAllByText(/reminders/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/poetry/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/news/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/budget/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/recipes/i).length).toBeGreaterThan(0)
    })
  })

  it('shows last backup date when available', async () => {
    renderDashboard()
    await waitFor(() => {
      // poetry-site has a last_backup set
      expect(screen.queryAllByText(/1\/15\/2026|15.01.2026|2026-01-15/i).length).toBeGreaterThan(0)
    })
  })

  it('renders backup rows in the table', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('reminders-app_20260101_120000.zip')).toBeInTheDocument()
      expect(screen.getByText('poetry-site_20260115_100000.zip')).toBeInTheDocument()
    })
  })

  it('renders download buttons for each backup', async () => {
    renderDashboard()
    await waitFor(() => {
      const buttons = screen.getAllByRole('button', { name: /download/i })
      expect(buttons.length).toBe(2)
    })
  })

  it('renders restore and delete buttons', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /restore/i })).toHaveLength(2)
      expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(2)
    })
  })

  // ── Backup creation ────────────────────────────────────────────────────────

  it('calls createBackup with the site name when button clicked', async () => {
    createBackup.mockResolvedValue({ job_id: 'job-123' })
    getJobStatus.mockResolvedValue({ status: 'done', message: 'Backup complete.', site: 'reminders-app', filename: 'x.zip' })
    renderDashboard()

    await waitFor(() => screen.getAllByRole('button', { name: /create backup/i }))
    const buttons = screen.getAllByRole('button', { name: /create backup/i })
    await userEvent.click(buttons[0])

    await waitFor(() => expect(createBackup).toHaveBeenCalledTimes(1))
  })

  it('shows pending indicator immediately after backup is triggered', async () => {
    createBackup.mockResolvedValue({ job_id: 'job-999' })
    // getJobStatus is polled every 2s — won't fire during the test, so we
    // only verify the immediate "Queued…" state that is set synchronously.
    renderDashboard()

    await waitFor(() => screen.getAllByRole('button', { name: /create backup/i }))
    const buttons = screen.getAllByRole('button', { name: /create backup/i })
    await userEvent.click(buttons[0])

    // Jobs bar appears immediately with the initial pending message
    await waitFor(() =>
      expect(screen.getByText(/queued/i)).toBeInTheDocument()
    )
  })

  // ── Delete backup ──────────────────────────────────────────────────────────

  it('calls deleteBackup and refreshes list after confirm', async () => {
    deleteBackup.mockResolvedValue({ ok: true })
    window.confirm = vi.fn().mockReturnValue(true)
    renderDashboard()

    await waitFor(() => screen.getAllByRole('button', { name: /delete/i }))
    await userEvent.click(screen.getAllByRole('button', { name: /delete/i })[0])

    await waitFor(() => expect(deleteBackup).toHaveBeenCalledTimes(1))
    expect(getSites).toHaveBeenCalledTimes(2) // initial + after delete
  })

  it('does not call deleteBackup when confirm is cancelled', async () => {
    window.confirm = vi.fn().mockReturnValue(false)
    renderDashboard()

    await waitFor(() => screen.getAllByRole('button', { name: /delete/i }))
    await userEvent.click(screen.getAllByRole('button', { name: /delete/i })[0])

    expect(deleteBackup).not.toHaveBeenCalled()
  })

  // ── Filter ─────────────────────────────────────────────────────────────────

  it('filters backup list by selected site', async () => {
    renderDashboard()
    await waitFor(() => screen.getByLabelText(/filter/i))

    const select = screen.getByLabelText(/filter/i)
    await userEvent.selectOptions(select, 'reminders-app')

    await waitFor(() => {
      expect(screen.getByText('reminders-app_20260101_120000.zip')).toBeInTheDocument()
      expect(screen.queryByText('poetry-site_20260115_100000.zip')).not.toBeInTheDocument()
    })
  })

  // ── Sign out ───────────────────────────────────────────────────────────────

  it('calls logout and navigates to /login on sign out', async () => {
    renderDashboard()
    await waitFor(() => screen.getByRole('button', { name: /sign out/i }))
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))

    expect(mockLogout).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  // ── Empty state ────────────────────────────────────────────────────────────

  it('shows empty-state message when no backups exist', async () => {
    getBackups.mockResolvedValue([])
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByText(/no backups yet/i)).toBeInTheDocument()
    )
  })
})
