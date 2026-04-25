export const COOKIE_TOKEN = 'remembered_token'
export const COOKIE_USER = 'remembered_user'

export const setCookie = (name, value, days) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`
}

export const getCookie = (name) => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export const clearRememberCookies = () => {
  document.cookie = `${COOKIE_TOKEN}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  document.cookie = `${COOKIE_USER}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}
