import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('admin_routine_token') || null,
  username: localStorage.getItem('admin_routine_user') || null,

  login: (token, username) => {
    localStorage.setItem('admin_routine_token', token)
    localStorage.setItem('admin_routine_user', username)
    set({ token, username })
  },

  logout: () => {
    localStorage.removeItem('admin_routine_token')
    localStorage.removeItem('admin_routine_user')
    set({ token: null, username: null })
  },
}))
