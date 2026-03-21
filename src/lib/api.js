import axios from 'axios'

export const AUTH_TOKEN_KEY = 'ticketflow_auth_token'
const LEGACY_AUTH_TOKEN_KEY = 'ticketflow_manager_token'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export const API = axios.create({ baseURL: API_BASE_URL })

let unauthorizedHandler = null

function isPublicAuthRequest(config) {
  const url = config?.url || ''
  return url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/google') || url.includes('/auth/config')
}

API.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY) || window.localStorage.getItem(LEGACY_AUTH_TOKEN_KEY)
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
  }

  return config
})

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && unauthorizedHandler && !isPublicAuthRequest(error.config)) {
      unauthorizedHandler(error)
    }

    return Promise.reject(error)
  },
)

export function clearStoredAuthToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY)
  }
}

export function getFriendlyErrorMessage(error, fallbackMessage) {
  if (error.response?.status === 401) {
    return error.response?.data?.error || 'Your session has expired. Please sign in again.'
  }

  if (error.response?.data?.error) {
    return error.response.data.error
  }

  if (error.code === 'ERR_NETWORK' || !error.response) {
    return 'Cannot reach the TicketFlow server. Start it with "npm run dev".'
  }

  return fallbackMessage
}

export function getStoredAuthToken() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(AUTH_TOKEN_KEY) || window.localStorage.getItem(LEGACY_AUTH_TOKEN_KEY)
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

export function storeAuthToken(token) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token)
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY)
  }
}
