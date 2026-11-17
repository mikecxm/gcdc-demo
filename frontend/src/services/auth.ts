import { apiClient } from "./api";

export interface LoginResponse {
  access: string;
  refresh: string;
  roles: string[];
  active_role: string | null;
  full_name: string;
}

// se manejará de este modo, para pruebas locales de la interfaz
const USE_MOCK = import.meta.env.VITE_USE_MOCK_LOGIN === "true";

const MOCK_RESPONSE: LoginResponse = {
  access: "token-falso",
  refresh: "token-falso",
  roles: ["COMITE", "AUTOR"],
  active_role: null,
  full_name: "Usuario de Prueba",
};

export async function login(email: string, password: string, recaptchaToken: string) {
  if (USE_MOCK) return MOCK_RESPONSE;

  const { data } = await apiClient.post<LoginResponse>("/auth/login/", {
    email,
    password,
    recaptcha_token: recaptchaToken, // mismo nombre que espera la GCDC-121
  });
  return data;
}