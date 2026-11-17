import axios from 'axios';

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
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('symposia_auth_token');
  if (token && token !== 'mock-dev-jwt-token-2026') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
