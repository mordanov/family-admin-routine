import api from './index'

export const login = async (username, password, rememberMe = false) => {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)
  form.append('remember_me', rememberMe ? 'true' : 'false')
  const { data } = await api.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data
}

export const getMe = async () => {
  const { data } = await api.get('/auth/me')
  return data
}
