import api from './index'

export const getCiRuns = () => api.get('/ci/runs').then((r) => r.data)
