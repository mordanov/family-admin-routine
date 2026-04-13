import api from './index'

export const getSystemInfo    = () => api.get('/system').then((r) => r.data)
export const getSystemDiskRam = () => api.get('/system/diskram').then((r) => r.data)
export const getSystemVolumes = () => api.get('/system/volumes').then((r) => r.data)
export const getSystemContainers = () => api.get('/system/containers').then((r) => r.data)
