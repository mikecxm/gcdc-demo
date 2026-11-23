import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
	Building2,
	ChevronLeft,
	ChevronRight,
	Eye,
	Search,
	UserRound,
	Users,
	UserX,
	UserCheck,
	X,
	ArrowUpDown,
	ShieldCheck,
	GraduationCap,
} from 'lucide-react';
import type { UserResponse, UserRole } from '../../services/api';
import type { UserListLoader } from '../../services/usersApi';
import { useAuth } from '../../context/SessionContext';
import { loadDemoUsers } from './userList.mock';
import { filterUsers, normalizeSearch, paginateUsers } from './userList.logic';
import { UserDeactivateModal } from './UserDeactivateModal';
import './UserDirectoryView.css';

const PAGE_SIZE = 10;

const ROLE_LABELS: Record<UserRole, string> = {
	ADMIN: 'Administrador',
	COMITE: 'Comité científico',
	AUTOR: 'Autor',
};

const AVATAR_COLORS = ['#e8eaf6', '#e4ede9', '#f3e8de', '#e8e6ef', '#e1ecf1'];

const ROLE_STYLES: Record<UserRole, string> = {
	ADMIN: 'border-indigo-200 bg-indigo-50 text-indigo-700',
	COMITE: 'border-violet-200 bg-violet-50 text-violet-700',
	AUTOR: 'border-sky-200 bg-sky-50 text-sky-700',
};


export interface UserListViewProps {
	embedded?: boolean;
	initialUsers?: UserResponse[];
	loadUsers?: UserListLoader;
	onEditProfile?: (user: UserResponse) => void;
	onToggleUserStatus?: (user: UserResponse) => void;
}

const getInitials = (fullName: string) =>
	fullName
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0] ?? '')
		.join('')
		.toUpperCase();

const formatDate = (date: string) =>
	new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(date));

export const UserListView = ({
	embedded = false,
	initialUsers,
	loadUsers = loadDemoUsers,
	onEditProfile,
	onToggleUserStatus,
}: UserListViewProps) => {
	const [users, setUsers] = useState<UserResponse[]>(initialUsers ?? []);
	const isDemo = initialUsers === undefined && loadUsers === loadDemoUsers;
	const [isLoading, setIsLoading] = useState(initialUsers === undefined);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [requestVersion, setRequestVersion] = useState(0);
	useEffect(() => {
		if (initialUsers !== undefined) {
			setUsers(initialUsers);
			setIsLoading(false);
			setLoadError(null);
			return;
		}
		const controller = new AbortController();
		setIsLoading(true);
		setLoadError(null);
		loadUsers(controller.signal).then((result) => {
			if (!controller.signal.aborted) setUsers(result);
		}).catch((error: unknown) => {
			if (!controller.signal.aborted) {
				setUsers([]);
				const status = axios.isAxiosError(error) ? error.response?.status : undefined;
				setLoadError(status === 403
					? 'El servidor rechazó el acceso al directorio. Intenta iniciar sesión de nuevo.'
					: status === 401
						? 'Tu sesión venció. Inicia sesión de nuevo para consultar el directorio.'
						: 'No pudimos cargar los usuarios. Intenta de nuevo o contacta al administrador.');
			}
		}).finally(() => {
			if (!controller.signal.aborted) setIsLoading(false);
		});
		return () => controller.abort();
	}, [initialUsers, loadUsers, requestVersion]);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedRole, setSelectedRole] = useState<UserRole | 'ALL'>('ALL');
	const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
	const [page, setPage] = useState(1);
	const [selectedUser, setSelectedUser] = useState<UserResponse | null>(null);
	const [userToDeactivate, setUserToDeactivate] = useState<UserResponse | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [sortOrder, setSortOrder] = useState<'NAME' | 'NEWEST'>('NAME');
	const profileDialog = useRef<HTMLDialogElement>(null);
	const tableScroll = useRef<HTMLDivElement>(null);

	const { session } = useAuth();

	const currentUserAuth = (() => {
		if (!session?.accessToken) return { id: null, email: null };
		try {
			const parts = session.accessToken.split('.');
			if (parts.length === 3) {
				const payload = JSON.parse(atob(parts[1]));
				return {
					id: typeof payload.user_id === 'number' ? payload.user_id : null,
					email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
				};
			}
		} catch {
			// ignore
		}
		return { id: null, email: null };
	})();

	const isPrivileged = session?.activeRole === 'ADMIN' || session?.activeRole === 'COMITE';
	const isAuthor = session?.activeRole === 'AUTOR';

	const isSelf = (targetUser: UserResponse) => Boolean(
		(currentUserAuth.id !== null && currentUserAuth.id === targetUser.id) ||
		(currentUserAuth.email !== null && currentUserAuth.email === targetUser.email.toLowerCase()) ||
		(Boolean(session?.fullName) && session?.fullName === targetUser.full_name)
	);

	const isDeactivateDisabled = (targetUser: UserResponse) => {
		if (onToggleUserStatus) return false;
		if (isSelf(targetUser)) return true;
		if (isAuthor) return true;
		if (!targetUser.is_active) return true;
		if (isPrivileged || isDemo) return false;
		return true;
	};

	const getDeactivateTitle = (targetUser: UserResponse) => {
		if (isSelf(targetUser)) return 'No puedes desactivar tu propia cuenta';
		if (isAuthor) return 'Solo administradores o comité pueden desactivar usuarios';
		if (!targetUser.is_active) return 'Usuario inactivo';
		return 'Desactivar usuario';
	};

	const getDeactivateAriaLabel = (targetUser: UserResponse) => {
		if (isSelf(targetUser)) return `No puedes desactivar tu propia cuenta (${targetUser.full_name})`;
		if (isAuthor) return `No tienes permisos para desactivar a ${targetUser.full_name}`;
		return `${targetUser.is_active ? 'Deshabilitar' : 'Activar'} usuario ${targetUser.full_name}`;
	};
	useEffect(() => {
		if (tableScroll.current) tableScroll.current.scrollTop = 0;
	}, [page, searchQuery, selectedRole, selectedStatus, sortOrder]);
	useEffect(() => {
		if (selectedUser) profileDialog.current?.showModal();
		else profileDialog.current?.close();
	}, [selectedUser]);

	const normalizedSearch = normalizeSearch(searchQuery.trim());
	const filteredUsers = filterUsers(users, { search: searchQuery, role: selectedRole, status: selectedStatus, sort: sortOrder });
	const { page: currentPage, pageCount, users: pageUsers, first: firstVisibleUser, last: lastVisibleUser } = paginateUsers(filteredUsers, page, PAGE_SIZE);

	const administratorCount = users.filter((user) => user.roles.includes('ADMIN')).length;
	const committeeCount = users.filter((user) => user.roles.includes('COMITE')).length;
	const authorCount = users.filter((user) => user.roles.includes('AUTOR')).length;
	const hasActiveFilters = Boolean(normalizedSearch) || selectedRole !== 'ALL' || selectedStatus !== 'ALL';

	const resetPage = () => setPage(1);

	const handleToggleUserStatus = (user: UserResponse) => {
		if (onToggleUserStatus) {
			onToggleUserStatus(user);
			return;
		}
		if (!isDemo || isPrivileged) {
			setUserToDeactivate(user);
			return;
		}

		const nextActiveState = !user.is_active;
		setUsers((currentUsers) =>
			currentUsers.map((currentUser) =>
				currentUser.id === user.id ? { ...currentUser, is_active: nextActiveState } : currentUser
			)
		);
		setNotice(`${user.full_name} ${nextActiveState ? 'fue activado' : 'fue deshabilitado'} en los datos de prueba.`);
	};

	const handleDeactivationSuccess = (deactivatedUser: UserResponse) => {
		setUserToDeactivate(null);
		setUsers((currentUsers) => currentUsers.filter((u) => u.id !== deactivatedUser.id));
		setNotice(`La cuenta de ${deactivatedUser.full_name} (${deactivatedUser.email}) ha sido desactivada correctamente.`);
		setRequestVersion((version) => version + 1);
	};

	const handleEditProfile = (user: UserResponse) => {
		if (onEditProfile) {
			onEditProfile(user);
			return;
		}
		setSelectedUser(user);
	};

	const indicators = [
		{ label: 'Usuarios registrados', count: users.length, icon: Users, tone: 'total' },
		{ label: 'Administradores', count: administratorCount, icon: ShieldCheck, tone: 'admin' },
		{ label: 'Comité científico', count: committeeCount, icon: Building2, tone: 'committee' },
		{ label: 'Autores registrados', count: authorCount, icon: GraduationCap, tone: 'author' },
	];

	return (
		<main className={`user-directory w-full text-left${embedded ? ' user-directory--embedded' : ''}`}>
			<header className="directory-header">
				<div><h1>Directorio de usuarios</h1><p>Consulta las personas, instituciones y permisos de la conferencia.</p></div>
			</header>
			<section aria-label="Resumen de usuarios" className="directory-summary">
				{indicators.map(({ label, count, icon: Icon, tone }) => <article key={tone} className="directory-stat"><span className={`directory-stat-icon directory-stat-icon--${tone}`}><Icon size={21} strokeWidth={1.7} aria-hidden="true" /></span><div><span>{label}</span><strong>{isLoading || loadError ? '\u2014' : count}</strong></div></article>)}
			</section>
			<div className="directory-workspace">
			<h2 className="sr-only">Listado de personas y filtros</h2>

			{notice && (
				<div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
					<p>{notice}</p>
					<button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso" className="rounded-md p-1 text-emerald-700 hover:bg-emerald-100">
						<X aria-hidden="true" className="h-4 w-4" />
					</button>
				</div>
			)}

			<section aria-label="Buscar y filtrar usuarios" className="directory-toolbar">
				<div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_13rem_13rem]">
					<label className="relative block">
						<span className="sr-only">Buscar por nombre, correo o institución</span>
						<Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
						<input
							type="search"
							value={searchQuery}
							onChange={(event) => { setSearchQuery(event.target.value); resetPage(); }}
							placeholder="Buscar por nombre, correo o institución"
							className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
						/>
					</label>
					<label>
						<span className="sr-only">Filtrar por rol</span>
						<select
							value={selectedRole}
							onChange={(event) => { setSelectedRole(event.target.value as UserRole | 'ALL'); resetPage(); }}
							className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
						>
							<option value="ALL">Todos los roles</option>
							<option value="ADMIN">Administrador</option>
							<option value="COMITE">Comité científico</option>
							<option value="AUTOR">Autor</option>
						</select>
					</label>
					<label>
						<span className="sr-only">Filtrar por estado</span>
						<select
							value={selectedStatus}
							onChange={(event) => { setSelectedStatus(event.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE'); resetPage(); }}
							className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
						>
							<option value="ALL">Todos los estados</option>
							<option value="ACTIVE">Activo</option>
							<option value="INACTIVE">Inactivo</option>
						</select>
					</label>
				</div>
				{hasActiveFilters && (
					<div className="mt-3 flex justify-end">
						<button
							type="button"
							onClick={() => { setSearchQuery(''); setSelectedRole('ALL'); setSelectedStatus('ALL'); resetPage(); }}
							className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
						>
							Limpiar filtros
						</button>
					</div>
					)}
			</section>

			<section aria-label="Listado de usuarios" aria-busy={isLoading} className="directory-list">
				<div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
					<p role="status" aria-live="polite" className="text-xs text-slate-500">{isLoading ? 'Cargando usuarios…' : loadError ? 'No se pudo obtener el listado' : `${filteredUsers.length} ${filteredUsers.length === 1 ? 'persona' : 'personas'}${hasActiveFilters ? ' coinciden con los filtros' : ' en el directorio'}`}</p>
					<label className="directory-sort"><ArrowUpDown size={14} aria-hidden="true" /><span className="sr-only">Ordenar usuarios</span><select value={sortOrder} onChange={(event) => { setSortOrder(event.target.value as 'NAME' | 'NEWEST'); resetPage(); }}><option value="NAME">Nombre A–Z</option><option value="NEWEST">Registro más reciente</option></select></label>
				</div>
				<div ref={tableScroll} className="directory-table-scroll" role="region" aria-label="Tabla de usuarios, área desplazable" tabIndex={0}>
					<table className="w-full min-w-[760px] border-collapse text-left">
						<thead className="bg-slate-50">
							<tr>
								<th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 sm:px-5">Usuario</th>
								<th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500">Afiliación institucional</th>
								<th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500">Rol</th>
								<th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500">Estado</th>
								<th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 sm:px-5">Acciones</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{isLoading && Array.from({ length: 6 }, (_, row) => (
								<tr key={`loading-${row}`} aria-hidden="true" className="directory-skeleton-row">
									{Array.from({ length: 5 }, (_, cell) => <td key={cell}><span className="directory-skeleton" /></td>)}
								</tr>
							))}
							{loadError && <tr><td colSpan={5} className="px-6 py-12 text-center"><p role="alert" className="text-sm text-slate-600">{loadError}</p><button type="button" onClick={() => setRequestVersion((version) => version + 1)} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">Reintentar</button></td></tr>}
							{!isLoading && !loadError && pageUsers.map((user) => (
								<tr key={user.id} className="transition-colors hover:bg-slate-50/70">
									<td className="px-4 py-3.5 sm:px-5">
										<div className="flex min-w-0 items-center gap-3">
											<span aria-hidden="true" style={{ backgroundColor: AVATAR_COLORS[user.id % AVATAR_COLORS.length] }} className="directory-avatar inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-medium text-slate-700">
												{getInitials(user.full_name)}
											</span>
											<div className="min-w-0">
												<p className="text-sm font-medium text-slate-900">{user.full_name}</p>
												<p className="text-xs text-slate-500">{user.email}</p>
												<p className="directory-mobile-meta">{user.roles.map((role) => ROLE_LABELS[role]).join(' · ')}<br />{user.affiliation || 'Sin afiliación'}</p>
											</div>
										</div>
									</td>
									<td className="max-w-56 px-4 py-3.5 text-sm text-slate-600">
										<span className="flex items-center gap-2">
											
											<span><span className="directory-institution">{user.affiliation || 'Sin afiliación'}</span><span className="directory-registered">Registro: {formatDate(user.created_at)}</span></span>
										</span>
									</td>
									<td className="px-4 py-3.5">
										<div className="flex flex-wrap gap-1.5">
											{user.roles.map((role) => (
												<span key={role} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${ROLE_STYLES[role]}`}>
													{ROLE_LABELS[role]}
												</span>
											))}
										</div>
									</td>
									<td className="px-4 py-3.5">
										<span className={`directory-status inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${user.is_active ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
											<span className={`h-1.5 w-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
											{user.is_active ? 'Activo' : 'Inactivo'}
										</span>
									</td>
									<td className="px-4 py-3.5 sm:px-5">
										<div className="flex items-center justify-end gap-1.5">
											<button
												type="button"
												onClick={() => handleEditProfile(user)}
												aria-label={`${onEditProfile ? 'Ver o editar' : 'Ver'} perfil de ${user.full_name}`}
												title="Ver/Editar perfil"
												className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
											>
												<Eye aria-hidden="true" className="h-4 w-4" />
												<span className="directory-profile-label">{onEditProfile ? 'Ver/Editar perfil' : 'Ver perfil'}</span>
											</button>
											<button
												type="button"
												onClick={() => handleToggleUserStatus(user)}
												disabled={isDeactivateDisabled(user)}
												aria-label={getDeactivateAriaLabel(user)}
												title={getDeactivateTitle(user)}
												className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
													isDeactivateDisabled(user)
														? 'cursor-not-allowed opacity-40 text-slate-400'
														: 'text-slate-500 hover:bg-rose-50 hover:text-rose-600 focus:ring-rose-500'
												}`}
											>
												{user.is_active ? <UserX aria-hidden="true" className="h-4 w-4" /> : <UserCheck aria-hidden="true" className="h-4 w-4" />}
											</button>
										</div>
									</td>
								</tr>
							))}
							{!isLoading && !loadError && pageUsers.length === 0 && (
								<tr>
									<td colSpan={5} className="px-5 py-14 text-center">
										<UserRound aria-hidden="true" className="mx-auto h-8 w-8 text-slate-300" />
										<p className="mt-3 text-sm font-medium text-slate-700">No encontramos usuarios</p>
										<p className="mt-1 text-xs text-slate-500">Prueba cambiar la búsqueda o los filtros seleccionados.</p>
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>

				<footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
					<p className="text-xs text-slate-500">
						{isLoading ? 'Cargando usuarios…' : loadError ? 'Listado no disponible' : <>
						Mostrando <span className="font-medium text-slate-700">{firstVisibleUser}–{lastVisibleUser}</span> de <span className="font-medium text-slate-700">{filteredUsers.length}</span> usuarios
						</>}
					</p>
					<nav aria-label="Paginación del directorio" className="flex items-center gap-2 self-end sm:self-auto">
						<button
							type="button"
							disabled={isLoading || Boolean(loadError) || currentPage <= 1}
							onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
							aria-label="Página anterior"
							className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
						>
							<ChevronLeft aria-hidden="true" className="h-4 w-4" />
						</button>
						<span className="min-w-16 text-center text-xs font-medium text-slate-600">{currentPage} / {pageCount}</span>
						<button
							type="button"
							disabled={isLoading || Boolean(loadError) || currentPage >= pageCount}
							onClick={() => setPage((currentPage) => Math.min(pageCount, currentPage + 1))}
							aria-label="Página siguiente"
							className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
						>
							<ChevronRight aria-hidden="true" className="h-4 w-4" />
						</button>
					</nav>
				</footer>
			</section>

			</div>
			<dialog ref={profileDialog} className="directory-profile" aria-labelledby="user-profile-title" onClose={() => setSelectedUser(null)} onClick={(event) => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setSelectedUser(null); } }}>
			{selectedUser && (
					<section className="p-6 sm:p-8">
						<div className="flex items-start justify-between gap-4">
							<div>
								<span aria-hidden="true" className="directory-profile-avatar" style={{ backgroundColor: AVATAR_COLORS[selectedUser.id % AVATAR_COLORS.length] }}>{getInitials(selectedUser.full_name)}</span>
								<p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Perfil de usuario</p>
								<h2 id="user-profile-title" className="mt-1 text-xl font-semibold text-slate-900">{selectedUser.full_name}</h2>
							</div>
							<button type="button" onClick={() => setSelectedUser(null)} aria-label="Cerrar perfil" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
								<X aria-hidden="true" className="h-4 w-4" />
							</button>
						</div>
						<dl className="mt-6 grid gap-4 sm:grid-cols-2">
							<div><dt className="text-xs text-slate-500">Correo</dt><dd className="mt-1 break-all text-sm text-slate-800">{selectedUser.email}</dd></div>
							<div><dt className="text-xs text-slate-500">Afiliación</dt><dd className="mt-1 text-sm text-slate-800">{selectedUser.affiliation || 'Sin afiliación'}</dd></div>
							<div><dt className="text-xs text-slate-500">Registro</dt><dd className="mt-1 text-sm text-slate-800">{formatDate(selectedUser.created_at)}</dd></div>
							<div><dt className="text-xs text-slate-500">Estado</dt><dd className="mt-1 text-sm text-slate-800">{selectedUser.is_active ? 'Activo' : 'Inactivo'}</dd></div>
							<div><dt className="text-xs text-slate-500">Roles asignados</dt><dd className="mt-1 text-sm text-slate-800">{selectedUser.roles.map((role) => ROLE_LABELS[role]).join(', ') || 'Sin roles'}</dd></div>
							{selectedUser.updated_at && <div><dt className="text-xs text-slate-500">Última actualización</dt><dd className="mt-1 text-sm text-slate-800">{formatDate(selectedUser.updated_at)}</dd></div>}
							<div className="sm:col-span-2"><dt className="text-xs text-slate-500">Biografía</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{selectedUser.bio?.trim() || 'Esta persona aún no ha añadido una biografía.'}</dd></div>
						</dl>
						<div className="mt-6 flex justify-end">
							<button type="button" onClick={() => setSelectedUser(null)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">Cerrar</button>
						</div>
					</section>
			)}
			</dialog>
			<UserDeactivateModal
				key={userToDeactivate?.id ?? 'none'}
				user={userToDeactivate}
				isOpen={Boolean(userToDeactivate)}
				onClose={() => setUserToDeactivate(null)}
				onSuccess={handleDeactivationSuccess}
			/>
		</main>
	);
};
