import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const paymentService = {
  processPayment: async (paymentData) => {
    const response = await api.post('/payments', paymentData)
    return response.data
  },

  getPayments: async (params = {}) => {
    const response = await api.get('/payments', { params })
    return response.data
  },

  getPaymentById: async (id) => {
    const response = await api.get(`/payments/${id}`)
    return response.data
  },

  refundPayment: async (id, amount) => {
    const response = await api.post(`/payments/${id}/refund`, { amount })
    return response.data
  }
}

export const dashboardService = {
  getStats: async () => {
    const response = await api.get('/dashboard/stats')
    return response.data
  },

  getTransactions: async (limit = 10) => {
    const response = await api.get(`/dashboard/transactions?limit=${limit}`)
    return response.data
  },

  getChartData: async (type, period = '30d') => {
    const response = await api.get(`/dashboard/charts/${type}?period=${period}`)
    return response.data
  }
}

export default api