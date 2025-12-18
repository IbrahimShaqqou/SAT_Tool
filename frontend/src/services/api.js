/**
 * SAT Tutoring Platform - API Service
 *
 * Axios instance and API call functions.
 */

import axios from 'axios';

// API base URL from environment or default
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors with token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          // TODO: Implement token refresh
          // const response = await api.post('/auth/refresh', { refresh_token: refreshToken });
          // localStorage.setItem('accessToken', response.data.access_token);
          // return api(originalRequest);
        }
      } catch (refreshError) {
        // Clear tokens and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// API functions will be added here
// export const authApi = { ... };
// export const questionsApi = { ... };
// export const testsApi = { ... };
// export const analyticsApi = { ... };
