import type { UserResponse, UserRole } from '../../services/api';

export interface UserListFilters {
  search: string;
  role: UserRole | 'ALL';
  status: 'ALL' | 'ACTIVE' | 'INACTIVE';
  sort: 'NAME' | 'NEWEST';
}

export const normalizeSearch = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

export function filterUsers(users: UserResponse[], filters: UserListFilters) {
  const search = normalizeSearch(filters.search.trim());
  return users.filter((user) =>
    (!search || normalizeSearch(`${user.full_name} ${user.email} ${user.affiliation}`).includes(search)) &&
    (filters.role === 'ALL' || user.roles.includes(filters.role)) &&
    (filters.status === 'ALL' || user.is_active === (filters.status === 'ACTIVE'))
  ).sort((a, b) => filters.sort === 'NEWEST'
    ? Date.parse(b.created_at) - Date.parse(a.created_at)
    : a.full_name.localeCompare(b.full_name, 'es'));
}

export function paginateUsers(users: UserResponse[], requestedPage: number, pageSize = 10) {
  const pageCount = Math.max(1, Math.ceil(users.length / pageSize));
  const page = Math.max(1, Math.min(requestedPage, pageCount));
  return {
    page, pageCount,
    users: users.slice((page - 1) * pageSize, page * pageSize),
    first: users.length ? (page - 1) * pageSize + 1 : 0,
    last: Math.min(page * pageSize, users.length),
  };
}
