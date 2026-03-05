import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Cache-buster for GET requests (avoid stale responses)
    if ((config.method || '').toLowerCase() === 'get') {
      config.params = { ...(config.params || {}), _: Date.now() };
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        localStorage.setItem('access_token', access);

        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login/', credentials),
  refresh: (refreshToken) => api.post('/auth/refresh/', { refresh: refreshToken }),
};

// Products API
export const productsAPI = {
  getAll: (params) => api.get('/products/', { params }),
  getOne: (id) => api.get(`/products/${id}/`),
  create: (data) => api.post('/products/', data),
  update: (id, data) => api.put(`/products/${id}/`, data),
  delete: (id) => api.delete(`/products/${id}/`),
  getLowStock: () => api.get('/products/low_stock/'),
  adjustStock: (id, adjustment) => api.post(`/products/${id}/adjust_stock/`, { adjustment }),
  getByBarcode: (barcode) => api.get('/products/by_barcode/', { params: { barcode } }),
};

// Categories API
export const categoriesAPI = {
  getAll: (params) => api.get('/categories/', { params }),
  getOne: (id) => api.get(`/categories/${id}/`),
  create: (data) => api.post('/categories/', data),
  update: (id, data) => api.put(`/categories/${id}/`, data),
  delete: (id) => api.delete(`/categories/${id}/`),
};

// Customers API
export const customersAPI = {
  getAll: (params) => api.get('/customers/', { params }),
  getOne: (id) => api.get(`/customers/${id}/`),
  create: (data) => api.post('/customers/', data),
  update: (id, data) => api.put(`/customers/${id}/`, data),
  delete: (id) => api.delete(`/customers/${id}/`),
  getTopCustomers: (limit = 10) => api.get('/customers/top_customers/', { params: { limit } }),
  getByPhone: (phone) => api.get('/customers/by_phone/', { params: { phone } }),
  addPoints: (id, points) => api.post(`/customers/${id}/add_points/`, { points }),
};

// Sales API
export const salesAPI = {
  getAll: (params) => api.get('/sales/', { params }),
  getOne: (id) => api.get(`/sales/${id}/`),
  create: (data) => api.post('/sales/', data),
  update: (id, data) => api.put(`/sales/${id}/`, data),
  delete: (id) => api.delete(`/sales/${id}/`),
  getStats: () => api.get('/sales/stats/'),
  getByDateRange: (startDate, endDate) => 
    api.get('/sales/by_date_range/', { params: { start_date: startDate, end_date: endDate } }),
  cancel: (id) => api.post(`/sales/${id}/cancel/`),
  getReturns: (id) => api.get(`/sales/${id}/returns/`),
  getReturnableItems: (id) => api.get(`/sales/${id}/returnable_items/`),
};

// Users API
export const usersAPI = {
  getAll: (params) => api.get('/users/', { params }),
  getOne: (id) => api.get(`/users/${id}/`),
  create: (data) => api.post('/users/', data),
  update: (id, data) => api.put(`/users/${id}/`, data),
  delete: (id) => api.delete(`/users/${id}/`),
  getCurrentUser: () => api.get('/users/me/'),
  getCashiers: () => api.get('/users/cashiers/'),
  getPerformance: (id) => api.get(`/users/${id}/performance/`),
  changeRole: (id, role) => api.post(`/users/${id}/change_role/`, { role }),
  getGroups: () => api.get('/auth/groups/'),
  createGroup: (data) => api.post('/auth/groups/', data),
  deleteGroup: (id) => api.delete(`/auth/groups/${id}/`),

  // Backward-compatible aliases (older UI code expected these names)
  getUsers: (params) => api.get('/users/', { params }),
  createUser: (data) => api.post('/users/', data),
  updateUser: (id, data) => api.put(`/users/${id}/`, data),
  deleteUser: (id) => api.delete(`/users/${id}/`),
};

// Returns API
export const returnsAPI = {
  getAll: (params) => api.get('/returns/', { params }),
  getOne: (id) => api.get(`/returns/${id}/`),
  create: (data) => api.post('/returns/', data),
  getStats: () => api.get('/returns/stats/'),
};

// Cash Register API
export const cashRegisterAPI = {
  getAll: (params) => api.get('/cash-registers/', { params }),
  getOne: (id) => api.get(`/cash-registers/${id}/`),
  getCurrent: () => api.get('/cash-registers/current/'),
  openShift: (data) => api.post('/cash-registers/open_shift/', data),
  closeShift: (id, data) => api.post(`/cash-registers/${id}/close_shift/`, data),
  getStats: () => api.get('/cash-registers/stats/'),
};

// Cash Transaction API
export const cashTransactionAPI = {
  getAll: (params) => api.get('/cash-transactions/', { params }),
  create: (data) => api.post('/cash-transactions/', data),
};

export default api;