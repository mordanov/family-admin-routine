import api from './index'

export const getSystemInfo = () => api.get('/system').then((r) => r.data)

