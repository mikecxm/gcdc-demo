import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { UserRoundPen, X, LockKeyhole, ShieldCheck, Check } from 'lucide-react';
import { apiClient, type UserResponse, type UserRole } from '../../services/api';

interface Props {
  isOpen: boolean;
  targetUser: UserResponse | null;
  currentUser: { id: number; roles: UserRole[] } | null;
  onClose: () => void;
  onSaved: (user: UserResponse) => void;
  onNotice: (message: string, error?: boolean) => void;
}
type Values = { full_name: string; affiliation: string; roles: UserRole[] };

export function UserProfileForm({ isOpen, targetUser, currentUser, onClose, onSaved, onNotice }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const { register, reset, handleSubmit, setError, setValue, watch, formState: { errors, isSubmitting } } = useForm<Values>({
    defaultValues: { full_name: '', affiliation: '', roles: [] },
  });
  const canEdit = Boolean(currentUser && targetUser && (
    currentUser.id === targetUser.id || currentUser.roles.some(role => role === 'ADMIN' || role === 'COMITE')
  ));
  const isOwnProfile = Boolean(currentUser && targetUser && currentUser.id === targetUser.id);
  const canChangeRoles = Boolean(
    currentUser && targetUser &&
    currentUser.roles.some(role => role === 'ADMIN' || role === 'COMITE')
  );
  const canAssignAdmin = currentUser?.roles.includes('ADMIN') ?? false;
  const selectedRoles = watch('roles') ?? [];
  useEffect(() => {
    if (isOpen && targetUser) {
      setApiError(null);
      reset({
        full_name: targetUser.full_name,
        affiliation: targetUser.affiliation,
        roles: targetUser.roles,
      });
      const element = dialog.current;
      element?.showModal();
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { element?.close(); document.body.style.overflow = previous; };
    }
    dialog.current?.close();
  }, [isOpen, targetUser, reset]);

  const submit = handleSubmit(async (values) => {
    if (!canEdit || !targetUser) return;
    setApiError(null);
    let rolesToSave = [...values.roles];
    if (!canAssignAdmin) {
      rolesToSave = rolesToSave.filter(role => role !== 'ADMIN');
      if (targetUser.roles.includes('ADMIN')) rolesToSave.push('ADMIN');
    }
    if (canChangeRoles && rolesToSave.length === 0) {
      setError('roles', { type: 'validate', message: 'Selecciona al menos un rol.' });
      return;
    }
    const rolesChanged = rolesToSave.length !== targetUser.roles.length ||
      targetUser.roles.some(role => !rolesToSave.includes(role));
    try {
      const payload = { full_name: values.full_name.trim(), affiliation: values.affiliation.trim(),
        ...(canChangeRoles && rolesChanged ? { roles: rolesToSave } : {}) };
      const { data } = await apiClient.patch<UserResponse>(`/users/${targetUser.id}/`, payload);
      onSaved(data);
      onNotice('Perfil actualizado correctamente');
      onClose();
    } catch (error) {
      const data = axios.isAxiosError(error) ? error.response?.data : null;
      const message = typeof data?.detail === 'string' ? data.detail : data && typeof data === 'object'
        ? Object.values(data).flat().join(' ') : 'No pudimos actualizar el perfil. Intenta de nuevo.';
      setApiError(message);
      onNotice(message, true);
    }
  });
  const input = 'mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[15px] font-normal text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-500';
  const label = 'block text-xs font-semibold text-slate-500';
  const roleLabels = { ADMIN: 'Administrador', COMITE: 'Comité', AUTOR: 'Autor' };
  return (
    <dialog ref={dialog} aria-labelledby="profile-title" aria-describedby="profile-description"
      onCancel={(event) => { event.preventDefault(); if (!isSubmitting) onClose(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[560px] overflow-hidden open:flex open:flex-col rounded-2xl border border-slate-200 bg-white p-0 text-left text-slate-900 shadow-2xl backdrop:bg-slate-950/40 backdrop:backdrop-blur-sm">
      <header className="relative shrink-0 border-b border-slate-100 px-6 pb-6 pt-7 sm:px-8">
        <button type="button" onClick={onClose} disabled={isSubmitting} aria-label="Cerrar edición de perfil" className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><X size={18} /></button>
        <div className="mb-4 inline-flex rounded-xl border border-indigo-100 bg-indigo-50 p-2.5 text-indigo-600"><UserRoundPen size={22} strokeWidth={1.7} /></div>
        <h2 id="profile-title" className="text-2xl font-semibold tracking-tight text-slate-950">{isOwnProfile ? 'Mi perfil' : 'Editar usuario'}</h2>
        <p id="profile-description" className="mt-2 max-w-sm text-sm font-normal leading-relaxed text-slate-500">{isOwnProfile ? 'Mantén tu información personal e institucional al día.' : 'Actualiza la información y los permisos de esta persona.'}</p>
      </header>
      <form onSubmit={submit} className="flex min-h-0 flex-col">
        <div className="min-h-0 space-y-7 overflow-y-auto px-6 py-6 sm:px-8">
          {!canEdit && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Solo puedes editar tu propio perfil.</p>}
          {apiError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{apiError}</div>}
          <section aria-labelledby="profile-personal-title">
            <h3 id="profile-personal-title" className="text-sm font-semibold text-slate-900">Información personal</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Tu identificación dentro de la conferencia.</p>
            <div className="mt-5 space-y-5">
              <label className={label}>Nombre completo <span className="text-indigo-500" aria-hidden="true">*</span>
                <input autoFocus autoComplete="name" {...register('full_name', { required: 'Ingresa el nombre completo.', validate: value => Boolean(value.trim()) || 'Ingresa el nombre completo.', maxLength: { value: 255, message: 'Máximo 255 caracteres.' } })} disabled={!canEdit || isSubmitting} aria-required="true" aria-invalid={Boolean(errors.full_name)} aria-describedby={errors.full_name ? 'profile-name-error' : undefined} className={input} />
                {errors.full_name && <span id="profile-name-error" className="mt-1.5 block text-xs font-normal text-rose-600">{errors.full_name.message}</span>}
              </label>
              <div>
                <label htmlFor="profile-email" className={`${label} flex items-center justify-between gap-2`}>Correo institucional<span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400"><LockKeyhole size={11} aria-hidden="true" />Solo lectura</span></label>
                <input id="profile-email" value={targetUser?.email ?? ''} readOnly aria-describedby="profile-email-help" className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-normal text-slate-600 outline-none focus:ring-2 focus:ring-slate-200" />
                <p id="profile-email-help" className="mt-2 text-xs leading-relaxed text-slate-400">El correo está vinculado a tu cuenta y no se puede modificar aquí.</p>
              </div>
              <label className={label}>Afiliación institucional
                <input autoComplete="organization" placeholder="Universidad o institución" {...register('affiliation', { maxLength: { value: 255, message: 'Máximo 255 caracteres.' } })} disabled={!canEdit || isSubmitting} aria-invalid={Boolean(errors.affiliation)} aria-describedby={errors.affiliation ? 'profile-affiliation-error' : undefined} className={input} />
                {errors.affiliation && <span id="profile-affiliation-error" className="mt-1.5 block text-xs font-normal text-rose-600">{errors.affiliation.message}</span>}
              </label>
            </div>
          </section>
          <section aria-labelledby="profile-access-title" className="border-t border-slate-100 pt-6">
            <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-slate-400" aria-hidden="true" /><h3 id="profile-access-title" className="text-sm font-semibold text-slate-900">Permisos de la cuenta</h3></div>
            {canChangeRoles ? <fieldset disabled={!canEdit || isSubmitting} className="mt-4">
              <legend className={label}>Roles asignados</legend>
              <div className="mt-2 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                {(['ADMIN', 'COMITE', 'AUTOR'] as const).map(role => {
                  const selected = selectedRoles.includes(role);
                  const lockedAdmin = role === 'ADMIN' && !canAssignAdmin;
                  return (
                    <label key={role} className={`flex items-center gap-2 rounded-xl border px-3 py-3.5 text-xs font-medium transition ${selected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'} ${lockedAdmin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={lockedAdmin}
                        onChange={() => {
                          const nextRoles = selected
                            ? selectedRoles.filter(value => value !== role)
                            : [...selectedRoles, role];
                          setValue('roles', nextRoles, { shouldDirty: true, shouldValidate: true });
                        }}
                        className="accent-indigo-600"
                      />
                      {roleLabels[role]}
                    </label>
                  );
                })}
              </div>
              {errors.roles && <p className="mt-2 text-xs text-rose-600">{errors.roles.message}</p>}
              <p className="mt-2 text-xs text-slate-500">
                Puedes asignar varios roles. Solo un administrador puede asignar o retirar el rol de Administrador.
              </p>
            </fieldset> : <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5"><div><p className="text-xs font-medium text-slate-500">Roles asignados</p><p className="mt-1 text-sm font-semibold text-slate-800">{targetUser?.roles.map(role => roleLabels[role]).join(' · ')}</p></div><LockKeyhole size={16} className="shrink-0 text-slate-400" aria-label="Roles protegidos" /></div>}
            {!canChangeRoles && <p className="mt-2 text-xs leading-relaxed text-slate-400">{isOwnProfile ? 'Tus roles son gestionados por un administrador o miembro del comité.' : 'No tienes permiso para cambiar los roles de esta persona.'}</p>}
          </section>
        </div>
        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-5 sm:px-8">
          <button type="button" disabled={isSubmitting} onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50">Cancelar</button>
          <button disabled={!canEdit || isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"><Check size={16} aria-hidden="true" />{isSubmitting ? 'Guardando…' : 'Guardar cambios'}</button>
        </footer>
      </form>
    </dialog>
  );
}
