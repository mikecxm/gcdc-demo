import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import {
  ACCESS_TOKEN_KEY,
  clearStoredAuth,
  REFRESH_TOKEN_KEY,
} from './authStorage';

export type UserRole = 'ADMIN' | 'COMITE' | 'AUTOR';

export interface UserCreatePayload {
  email: string;
  full_name: string;
  affiliation: string;
  password: string;
  role?: UserRole;
}

export interface UserResponse {
  id: number;
  email: string;
  full_name: string;
  affiliation: string;
  roles: UserRole[];
  is_active: boolean;
  created_at: string;
  bio?: string | null;
  updated_at?: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/+$/, '');
type RetriableRequestConfig = InternalAxiosRequestConfig & { _authRetry?: boolean };

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.setContentType(false);
  }

  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshRequest: Promise<string> | null = null;

const refreshAccessToken = (refreshToken: string): Promise<string> => {
  if (!refreshRequest) {
    refreshRequest = axios
      .post<{ access: string }>(`${API_BASE_URL}/auth/refresh/`, { refresh: refreshToken })
      .then(({ data }) => {
        if (!data.access) throw new Error('El servidor no devolvió un token de acceso.');
        localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
        return data.access;
      })
      .catch((error: unknown) => {
        clearStoredAuth();
        window.dispatchEvent(new Event('symposia:auth-expired'));
        throw error;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RetriableRequestConfig | undefined;
    const url = request?.url ?? '';
    const isAuthRequest = url.includes('/auth/login/') || url.includes('/auth/refresh/');

    if (error.response?.status !== 401 || !request || request._authRetry || isAuthRequest) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      clearStoredAuth();
      window.dispatchEvent(new Event('symposia:auth-expired'));
      return Promise.reject(error);
    }

    request._authRetry = true;
    try {
      const accessToken = await refreshAccessToken(refreshToken);
      request.headers.set('Authorization', `Bearer ${accessToken}`);
      return apiClient(request);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

export const registerUser = async (
  payload: Omit<UserCreatePayload, 'role'>
): Promise<UserResponse> => {
  const response = await apiClient.post<UserResponse>('/users/register/', payload);
  return response.data;
};

export const adminCreateUser = async (
  payload: UserCreatePayload
): Promise<UserResponse> => {
  const response = await apiClient.post<UserResponse>('/users/create/', payload);
  return response.data;
};
