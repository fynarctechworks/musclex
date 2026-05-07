import axios from 'axios';
import { API_URL } from './constants';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('scc_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('scc_refresh_token');
      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          localStorage.setItem('scc_access_token', data.data.access_token);
          localStorage.setItem('scc_refresh_token', data.data.refresh_token);
          error.config.headers.Authorization = `Bearer ${data.data.access_token}`;
          return api(error.config);
        } catch {
          localStorage.removeItem('scc_access_token');
          localStorage.removeItem('scc_refresh_token');
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('scc_access_token');
        localStorage.removeItem('scc_refresh_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
