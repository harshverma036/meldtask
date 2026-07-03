import axios from "axios";

/**
 * Axios instance pre-configured for the API.
 * - Base URL is /api (Vite dev proxy handles forwarding to backend).
 * - Bearer token automatically injected from localStorage.
 * - 401 responses trigger logout.
 */
const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Inject auth token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — clear token and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("auth_token");
      // Only redirect if not already on login page
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
