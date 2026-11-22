import React, { useState, useEffect, useCallback } from 'react';
import type { Article } from '../../types/article';
import { disableArticle } from '../../services/articlesApi';
import {
  AlertTriangle,
  X,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

interface DisableArticleModalProps {
  article: Article | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (articleId: number, reason: string) => void;
}

export const DisableArticleModal: React.FC<DisableArticleModalProps> = ({
  article,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState<string>('');
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    setReason('');
    setIsConfirmed(false);
    setErrorMessage(null);
    onClose();
  }, [isSubmitting, onClose]);

  // Manejo de la tecla Escape; el modal padre controla el bloqueo de scroll.
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

  if (!isOpen || !article) {
    return null;
  }

  const trimmedReason = reason.trim();
  const isReasonValid = trimmedReason.length >= 10;
  const canSubmit = isReasonValid && isConfirmed && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await disableArticle(article.id, trimmedReason);
      onSuccess(article.id, trimmedReason);
      handleClose();
    } catch (err: unknown) {
      console.error('Error al deshabilitar el artículo:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Ocurrió un error inesperado al deshabilitar el artículo.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disable-modal-title"
    >
      {/* Backdrop con clic para cerrar */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (!isSubmitting) handleClose();
        }}
        aria-hidden="true"
      />

      {/* Tarjeta del Modal */}
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-rose-200 overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera Crítica / Alerta Roja */}
        <div className="bg-rose-50/90 border-b border-rose-100 p-5 sm:p-6 flex items-start gap-3.5 text-left">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
          </div>

          <div className="flex-1 pr-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-rose-600 tracking-wider uppercase">
                ACCIÓN ADMINISTRATIVA CRÍTICA
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ID #{article.id}
              </span>
            </div>
            <h2
              id="disable-modal-title"
              className="text-base sm:text-lg font-bold text-slate-900 leading-snug mt-0.5"
            >
              Deshabilitar Artículo
            </h2>
            <p className="text-xs text-slate-600 font-medium line-clamp-1 mt-0.5" title={article.title}>
              &ldquo;{article.title}&rdquo;
            </p>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClose}
            aria-label="Cerrar modal de deshabilitación"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-rose-100/60 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario y Contenido */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 text-left">
          {/* Alerta Visual Obligatoria Textual */}
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200/90 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-xs font-bold text-rose-900 block">
                Advertencia de Deshabilitación
              </span>
              <p className="text-xs text-rose-800 leading-relaxed font-semibold">
                Esta acción no se puede deshacer. El artículo será retirado de las consultas y de la agenda
              </p>
            </div>
          </div>

          {/* Mensaje de error si falla el backend */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Campo obligatorio de motivo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="disable-reason-input"
                className="text-xs font-semibold text-slate-700"
              >
                Motivo de la deshabilitación <span className="text-rose-600">*</span>
              </label>
              <span
                className={`text-[11px] font-mono ${
                  isReasonValid ? 'text-slate-400' : 'text-amber-600 font-semibold'
                }`}
              >
                {trimmedReason.length}/10 caracteres mín.
              </span>
            </div>

            <textarea
              id="disable-reason-input"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              placeholder="Indica detalladamente el motivo de la deshabilitación (ej. retiro formal solicitado por el autor, detección de plagio o conflicto ético grave)..."
              className={`w-full p-3 text-xs bg-slate-50 border rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white transition-all resize-none ${
                trimmedReason.length > 0 && !isReasonValid
                  ? 'border-amber-300 focus:border-amber-500'
                  : 'border-slate-200 focus:border-rose-500'
              }`}
              required
            />

            {trimmedReason.length > 0 && !isReasonValid && (
              <p className="text-[11px] text-amber-700">
                Faltan {10 - trimmedReason.length} caracteres para cumplir con el mínimo requerido.
              </p>
            )}
          </div>

          {/* Checkbox de Doble Confirmación Obligatorio */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                id="disable-irreversible-confirm"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 w-4 h-4 rounded text-rose-600 border-slate-300 focus:ring-rose-500 cursor-pointer"
              />
              <span className="text-xs font-medium text-slate-800 leading-snug">
                Confirmo que entiendo que esta acción es irreversible
              </span>
            </label>
          </div>

          {/* Botones de Acción */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deshabilitando artículo...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Confirmar deshabilitación</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
