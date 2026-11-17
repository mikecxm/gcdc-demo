import { apiClient } from "./api";
import type { Role } from "../context/SessionContext";

export interface LoginResponse {
  access: string;
  refresh: string;
  roles: Role[];
  active_role: Role | null;
  full_name: string;
}

export async function login(email: string, password: string, recaptchaToken: string) {
  const { data } = await apiClient.post<LoginResponse>("/auth/login/", {
    email,
    password,
    recaptcha_token: recaptchaToken, // mismo nombre que espera la GCDC-121
  });
  return data;
}