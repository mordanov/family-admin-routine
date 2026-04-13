import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAuthStore } from '../src/store/authStore'

const TOKEN = 'test.jwt.token'
const USERNAME = 'admin1'

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ token: null, username: null })
  })

  it('initialises with null when localStorage is empty', () => {
    const { result } = renderHook(() => useAuthStore())
    expect(result.current.token).toBeNull()
    expect(result.current.username).toBeNull()
  })

  it('reads token and username from localStorage on mount', () => {
    localStorage.setItem('admin_routine_token', TOKEN)
    localStorage.setItem('admin_routine_user', USERNAME)
    useAuthStore.setState({
      token: localStorage.getItem('admin_routine_token'),
      username: localStorage.getItem('admin_routine_user'),
    })
    const { result } = renderHook(() => useAuthStore())
    expect(result.current.token).toBe(TOKEN)
    expect(result.current.username).toBe(USERNAME)
  })

  it('login stores token and username in state and localStorage', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current.login(TOKEN, USERNAME))
    expect(result.current.token).toBe(TOKEN)
    expect(result.current.username).toBe(USERNAME)
    expect(localStorage.getItem('admin_routine_token')).toBe(TOKEN)
    expect(localStorage.getItem('admin_routine_user')).toBe(USERNAME)
  })

  it('logout clears state and localStorage', () => {
    useAuthStore.setState({ token: TOKEN, username: USERNAME })
    localStorage.setItem('admin_routine_token', TOKEN)
    localStorage.setItem('admin_routine_user', USERNAME)

    const { result } = renderHook(() => useAuthStore())
    act(() => result.current.logout())

    expect(result.current.token).toBeNull()
    expect(result.current.username).toBeNull()
    expect(localStorage.getItem('admin_routine_token')).toBeNull()
    expect(localStorage.getItem('admin_routine_user')).toBeNull()
  })

  it('login overwrites a previously stored token', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current.login('old.token', 'admin2'))
    act(() => result.current.login(TOKEN, USERNAME))
    expect(result.current.token).toBe(TOKEN)
    expect(result.current.username).toBe(USERNAME)
  })
})
