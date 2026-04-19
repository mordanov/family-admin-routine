import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_routine_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let redirecting = false

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !redirecting) {
      redirecting = true
      useAuthStore.getState().logout()
      window.location.replace('/login')
    }
    return Promise.reject(err)
  }
)

export default api
