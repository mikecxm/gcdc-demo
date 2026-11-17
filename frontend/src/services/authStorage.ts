export const ACCESS_TOKEN_KEY = 'symposia_auth_token';
export const REFRESH_TOKEN_KEY = 'symposia_refresh_token';
export const ACTIVE_ROLE_KEY = 'symposia_active_role';
export const USER_ROLES_KEY = 'symposia_user_roles';
export const FULL_NAME_KEY = 'symposia_user_full_name';

export const clearStoredAuth = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ACTIVE_ROLE_KEY);
  localStorage.removeItem(USER_ROLES_KEY);
  localStorage.removeItem(FULL_NAME_KEY);
};
