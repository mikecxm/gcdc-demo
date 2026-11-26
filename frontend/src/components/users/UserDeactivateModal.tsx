import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { AlertTriangle, Loader2, UserX, X } from 'lucide-react';
import type { UserResponse, UserRole } from '../../services/api';
import { deactivateUser } from '../../services/usersApi';

interface UserDeactivateModalProps {
  user: UserResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserResponse) => void;
}

const AVATAR_COLORS = ['#e8eaf6', '#e4ede9', '#f3e8de', '#e8e6ef', '#e1ecf1'];

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  COMITE: 'Comité científico',
  AUTOR: 'Autor',
};

const ROLE_STYLES: Record<UserRole, string> = {
  ADMIN: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  COMITE: 'border-violet-200 bg-violet-50 text-violet-700',
  AUTOR: 'border-indigo-100 bg-indigo-50/50 text-indigo-700',
};

const getInitials = (fullName: string) =>
  fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();

export const UserDeactivateModal: React.FC<UserDeactivateModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    setIsConfirmed(false);
    setErrorMessage(null);
    onClose();
  }, [isSubmitting, onClose]);

  // Cierre accesible con tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSubmitting, handleClose]);

  if (!isOpen || !user) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await deactivateUser(user.id);
      onSuccess(user);
      handleClose();
    } catch (err: unknown) {
      let detail = 'Ocurrió un error inesperado al desactivar el usuario.';
      if (axios.isAxiosError(err)) {
        if (typeof err.response?.data?.detail === 'string') {
          detail = err.response.data.detail;
        } else if (err.response?.status === 403) {
          detail = 'No tienes permiso para desactivar usuarios. Se requiere rol ADMIN o COMITE.';
        } else if (err.response?.status === 400) {
          detail = 'No fue posible desactivar esta cuenta.';
        } else if (err.response?.status === 404) {
          detail = 'El usuario no fue encontrado o ya ha sido dado de baja.';
        }
      } else if (err instanceof Error) {
        detail = err.message;
      }
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deactivate-user-modal-title"
    >
      {/* Backdrop con clic para cerrar */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (!isSubmitting) handleClose();
        }}
        aria-hidden="true"
      />

      {/* Contenedor del Modal */}
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 p-6 sm:p-8 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5 text-rose-600" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="deactivate-user-modal-title"
                className="text-base sm:text-lg font-bold text-slate-900 leading-snug"
              >
                Desactivar cuenta de usuario
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Confirmación de baja lógica en el sistema
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClose}
            aria-label="Cerrar modal de desactivación"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-left">
          {/* Tarjeta resumen del usuario */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                style={{ backgroundColor: AVATAR_COLORS[user.id % AVATAR_COLORS.length] }}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-slate-700"
              >
                {getInitials(user.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user.full_name}
                </p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                <p className="text-xs text-slate-600 mt-0.5 truncate">
                  {user.affiliation || 'Sin afiliación'}
                </p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-wrap gap-1.5">
              {user.roles.map((role) => (
                <span
                  key={role}
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_STYLES[role]}`}
                >
                  {ROLE_LABELS[role]}
                </span>
              ))}
            </div>
          </div>

          {/* Alerta Informativa Destacada */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1 text-xs">
              <span className="font-bold text-amber-900 block">
                Consecuencias de la baja lógica
              </span>
              <p className="text-amber-800 leading-relaxed font-medium">
                El acceso y las sesiones activas de esta persona se revocarán de inmediato.
                Sin embargo, sus artículos, versiones y evaluaciones académicas se conservarán intactas
                para preservar la integridad del historial de la conferencia.
              </p>
            </div>
          </div>

          {/* Checkbox Obligatorio de Doble Verificación */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                id="confirm-user-deactivation"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 w-4 h-4 rounded text-rose-600 border-slate-300 focus:ring-rose-500 cursor-pointer"
              />
              <span className="text-xs font-medium text-slate-800 leading-snug">
                Entiendo que esta cuenta perderá el acceso al sistema de inmediato.
              </span>
            </label>
          </div>

          {/* Bloque de error inline */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Footer de Acciones */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!isConfirmed || isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Desactivando...</span>
                </>
              ) : (
                <>
                  <UserX className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Confirmar baja</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
