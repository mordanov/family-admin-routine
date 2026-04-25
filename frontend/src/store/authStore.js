import { create } from 'zustand'
import { COOKIE_TOKEN, COOKIE_USER, setCookie, getCookie, clearRememberCookies } from '../utils/cookies'

const REMEMBER_EXPIRE_DAYS = 30

const initToken = () => {
  const stored = localStorage.getItem('admin_routine_token')
  if (stored) return stored
  const fromCookie = getCookie(COOKIE_TOKEN)
  if (fromCookie) {
    localStorage.setItem('admin_routine_token', fromCookie)
    return fromCookie
  }
  return null
}

const initUsername = () => {
  const stored = localStorage.getItem('admin_routine_user')
  if (stored) return stored
  const fromCookie = getCookie(COOKIE_USER)
  if (fromCookie) {
    localStorage.setItem('admin_routine_user', fromCookie)
    return fromCookie
  }
  return null
}

export const useAuthStore = create((set) => ({
  token: initToken(),
  username: initUsername(),

  login: (token, username, rememberMe = false) => {
    localStorage.setItem('admin_routine_token', token)
    localStorage.setItem('admin_routine_user', username)
    if (rememberMe) {
      setCookie(COOKIE_TOKEN, token, REMEMBER_EXPIRE_DAYS)
      setCookie(COOKIE_USER, username, REMEMBER_EXPIRE_DAYS)
    } else {
      clearRememberCookies()
    }
    set({ token, username })
  },

  logout: () => {
    localStorage.removeItem('admin_routine_token')
    localStorage.removeItem('admin_routine_user')
    clearRememberCookies()
    set({ token: null, username: null })
  },
}))
