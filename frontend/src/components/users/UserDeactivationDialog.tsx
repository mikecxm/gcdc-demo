import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { UserX, X } from 'lucide-react';
import { apiClient, type UserResponse } from '../../services/api';

interface Props {
  targetUser: UserResponse | null;
  onClose: () => void;
  onDeactivated: () => void;
}

export function UserDeactivationDialog({ targetUser, onClose, onDeactivated }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!targetUser) { element?.close(); return; }
    setError(null);
    element?.showModal();
    return () => element?.close();
  }, [targetUser]);

  const deactivate = async () => {
    if (!targetUser || pending) return;
    setPending(true);
    setError(null);
    try {
      await apiClient.delete(`/users/${targetUser.id}/`);
      onDeactivated();
      onClose();
    } catch (cause) {
      const data = axios.isAxiosError(cause) ? cause.response?.data : null;
      setError(typeof data?.detail === 'string' ? data.detail : 'No pudimos desactivar el usuario. Intenta de nuevo.');
    } finally { setPending(false); }
  };

  return <dialog ref={dialog} aria-labelledby="deactivation-title" aria-describedby="deactivation-description" onCancel={event => { event.preventDefault(); if (!pending) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-2xl backdrop:bg-slate-950/40 backdrop:backdrop-blur-sm sm:p-8">
    <div className="flex items-start justify-between"><span className="rounded-xl bg-rose-50 p-3 text-rose-600"><UserX size={23} aria-hidden="true" /></span><button type="button" disabled={pending} onClick={onClose} aria-label="Cerrar confirmación" className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500"><X size={18} /></button></div>
    <h2 id="deactivation-title" className="mt-5 text-xl font-semibold tracking-tight text-slate-950">Desactivar usuario</h2>
    <p id="deactivation-description" className="mt-3 text-sm leading-relaxed text-slate-600"><strong className="font-semibold text-slate-900">{targetUser?.full_name}</strong> perderá el acceso a la plataforma.</p>
    <p className="mt-1 break-all text-xs text-slate-400">{targetUser?.email}</p>
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">Se conservarán sus asignaciones y evaluaciones previas. Si tiene revisiones pendientes como jurado, la desactivación no las reasigna ni las cancela.</div>
    <p className="mt-3 text-xs leading-relaxed text-slate-500">El usuario dejará de aparecer en el directorio. Esta pantalla no permite reactivar la cuenta.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5"><button autoFocus type="button" disabled={pending} onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 focus-visible:ring-2 focus-visible:ring-indigo-500">Cancelar</button><button type="button" disabled={pending} onClick={deactivate} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:opacity-50">{pending ? 'Desactivando…' : 'Desactivar usuario'}</button></div>
  </dialog>;
}
