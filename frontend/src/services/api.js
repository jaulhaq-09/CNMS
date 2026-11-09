import axios from 'axios'

const API_URL = 'http://localhost:5000'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cnms_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-refresh on 401 TOKEN_EXPIRED, retry original request once
let isRefreshing = false
let refreshSubscribers = []

function onRefreshed(newToken) {
  refreshSubscribers.forEach((cb) => cb(newToken))
  refreshSubscribers = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const status = error.response?.status

    // Requests made with responseType:'blob' (like the export endpoints)
    // get their error body back as a Blob too, even for JSON error
    // payloads — so error.response.data.code is undefined unless we
    // explicitly read and parse the blob's text first.
    let code = error.response?.data?.code
    if (status === 401 && error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text()
        const parsed = JSON.parse(text)
        code = parsed.code
        // Replace the blob with the parsed body so any UI reading
        // error.response.data.message downstream also works correctly.
        error.response.data = parsed
      } catch {
        // Body wasn't JSON (or was empty) — leave code as undefined and
        // fall through to the generic rejection below.
      }
    }

    if (status === 401 && code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshToken = localStorage.getItem('cnms_refresh_token')
      if (!refreshToken) {
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (!isRefreshing) {
        isRefreshing = true
        try {
          const res = await axios.post(`${API_URL}/api/auth/refresh-token`, { refreshToken })
          const newToken = res.data.data.token
          localStorage.setItem('cnms_token', newToken)
          isRefreshing = false
          onRefreshed(newToken)
        } catch (refreshError) {
          isRefreshing = false
          localStorage.clear()
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      }

      return new Promise((resolve) => {
        refreshSubscribers.push((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          resolve(api(originalRequest))
        })
      })
    }

    return Promise.reject(error)
  }
)

export default api