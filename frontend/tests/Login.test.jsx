import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../src/pages/Login'
import { useAuthStore } from '../src/store/authStore'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../src/store/authStore', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('../src/api/auth', () => ({
  login: vi.fn(),
}))

import { login as loginApi } from '../src/api/auth'

const renderLogin = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )

describe('LoginPage', () => {
  const mockStoreLogin = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.mockReturnValue({ login: mockStoreLogin })
  })

  it('renders username and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('renders a sign in button', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('calls login API with entered credentials on submit', async () => {
    loginApi.mockResolvedValue({ access_token: 'tok123', token_type: 'bearer' })
    renderLogin()

    await userEvent.type(screen.getByLabelText(/username/i), 'admin1')
    await userEvent.type(screen.getByLabelText(/password/i), 'pass1')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(loginApi).toHaveBeenCalledWith('admin1', 'pass1', false)
    )
  })

  it('stores token in auth store on success', async () => {
    loginApi.mockResolvedValue({ access_token: 'tok123', token_type: 'bearer' })
    renderLogin()

    await userEvent.type(screen.getByLabelText(/username/i), 'admin1')
    await userEvent.type(screen.getByLabelText(/password/i), 'pass1')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(mockStoreLogin).toHaveBeenCalledWith('tok123', 'admin1', false)
    )
  })

  it('navigates to / on successful login', async () => {
    loginApi.mockResolvedValue({ access_token: 'tok123', token_type: 'bearer' })
    renderLogin()

    await userEvent.type(screen.getByLabelText(/username/i), 'admin1')
    await userEvent.type(screen.getByLabelText(/password/i), 'pass1')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })

  it('shows error message on login failure', async () => {
    loginApi.mockRejectedValue(new Error('401'))
    renderLogin()

    await userEvent.type(screen.getByLabelText(/username/i), 'admin1')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    )
  })

  it('does not navigate on login failure', async () => {
    loginApi.mockRejectedValue(new Error('401'))
    renderLogin()

    await userEvent.type(screen.getByLabelText(/username/i), 'admin1')
    await userEvent.type(screen.getByLabelText(/password/i), 'bad')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument())
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('disables button while submitting', async () => {
    let resolve
    loginApi.mockReturnValue(new Promise((r) => { resolve = r }))
    renderLogin()

    await userEvent.type(screen.getByLabelText(/username/i), 'admin1')
    await userEvent.type(screen.getByLabelText(/password/i), 'pass1')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    resolve({ access_token: 'tok', token_type: 'bearer' })
  })
})
