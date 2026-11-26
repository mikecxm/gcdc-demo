import { apiClient, type UserResponse } from './api';

export type UserListLoader = (signal: AbortSignal) => Promise<UserResponse[]>;

function isUser(value: unknown): value is UserResponse {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return typeof user.id === 'number' && typeof user.full_name === 'string' &&
    typeof user.email === 'string' && typeof user.affiliation === 'string' &&
    typeof user.is_active === 'boolean' && typeof user.created_at === 'string' &&
    Number.isFinite(Date.parse(user.created_at)) && Array.isArray(user.roles) &&
    user.roles.every((role) => ['ADMIN', 'COMITE', 'AUTOR'].includes(role));
}

// Supports a full array or DRF pagination; loads all pages for client pagination.
export function createUserListLoader(endpoint: string): UserListLoader {
  return async (signal) => {
    if (!endpoint.trim()) throw new Error('No pudimos cargar los usuarios. Inténtalo de nuevo.');
    const base = new URL(`${apiClient.defaults.baseURL?.replace(/\/$/, '')}/`, window.location.origin);
    let next: string | null = new URL(endpoint.replace(/^\//, ''), base).href;
    const visited = new Set<string>();
    const users: UserResponse[] = [];
    while (next) {
      const url = new URL(next);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || visited.has(url.href)) {
        throw new Error('La paginación de usuarios no es válida.');
      }
      visited.add(url.href);
      const { data } = await apiClient.get<unknown>(url.href, { signal });
      const paginated = !Array.isArray(data) && data !== null && typeof data === 'object'
        ? data as { results?: unknown; next?: unknown } : null;
      const rows = paginated ? paginated.results : data;
      if (!Array.isArray(rows) || !rows.every(isUser)) throw new Error('El listado recibido no tiene el formato esperado.');
      users.push(...rows);
      if (paginated?.next !== undefined && paginated.next !== null && typeof paginated.next !== 'string') {
        throw new Error('La paginación de usuarios no es válida.');
      }
      next = typeof paginated?.next === 'string' && paginated.next
        ? new URL(paginated.next, url).href : null;
    }
    return [...new Map(users.map((user) => [user.id, user])).values()];
  };
}

export const loadConfiguredUsers = createUserListLoader(import.meta.env.VITE_USERS_LIST_PATH?.trim() || 'users/');

export async function deactivateUser(userId: number): Promise<void> {
  await apiClient.delete(`/users/${userId}/`);
}

