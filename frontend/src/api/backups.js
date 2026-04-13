import api from './index'

export const getSites = () => api.get('/sites').then((r) => r.data)
export const getBackups = () => api.get('/backups').then((r) => r.data)

export const createBackup = (site) =>
  api.post('/backups/create', { site }).then((r) => r.data)

export const getJobStatus = (jobId) =>
  api.get(`/backups/status/${jobId}`).then((r) => r.data)

export const restoreBackup = (filename) =>
  api.post(`/backups/${encodeURIComponent(filename)}/restore`).then((r) => r.data)

export const deleteBackup = (filename) =>
  api.delete(`/backups/${encodeURIComponent(filename)}`).then((r) => r.data)

export const downloadBackup = async (filename) => {
  const response = await api.get(`/backups/${encodeURIComponent(filename)}/download`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
