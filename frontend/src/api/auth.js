import api from './index'

export const login = async (username, password) => {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)
  const { data } = await api.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data
}

export const getMe = async () => {
  const { data } = await api.get('/auth/me')
  return data
}
