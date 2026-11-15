import React, { useEffect, useRef, useState } from 'react';
import type { Article, ArticleVersion } from '../../types/article';
import { getStatusBadgeConfig } from '../../types/article';
import { useAuth } from '../../context';
import { PdfVersionManager } from './PdfVersionManager';
import {
  X,
  ExternalLink,
  FileText,
  Calendar,
  User,
  Mail,
  Building2,
  Users,
  Tag,
  ShieldCheck,
} from 'lucide-react';

interface ArticleDetailModalProps {
  article: Article | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ArticleDetailModal: React.FC<ArticleDetailModalProps> = ({
  article,
  isOpen,
  onClose,
}) => {
  const { isAuthenticated, role, token, user } = useAuth();
  const [currentPdfUrl, setCurrentPdfUrl] = useState(article?.pdf_url ?? '');
  const [localVersions, setLocalVersions] = useState<ArticleVersion[]>([]);
  const objectUrls = useRef(new Set<string>());

  // Manejo de la tecla Escape y bloqueo de scroll en el body
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  useEffect(
    () => () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current.clear();
    },
    [article?.id]
  );

  if (!isOpen || !article) {
    return null;
  }

  const statusConfig = getStatusBadgeConfig(article.status);
  const StatusIcon = statusConfig.icon;

  const formattedDate = new Date(article.submitted_at).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const keywordsList = article.keywords
    ? article.keywords.split(',').map((k) => k.trim())
    : [];
  const pdfUrl = currentPdfUrl || article.pdf_url;
  const canManagePdf =
    isAuthenticated && role === 'AUTOR' && user?.roles.includes('AUTOR');
  const handleCurrentPdfUrlChange = (url: string) => {
    if (url.startsWith('blob:')) objectUrls.current.add(url);
    setCurrentPdfUrl(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="article-detail-title"
    >
      {/* Backdrop desenfocado con click para cerrar */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Contenedor Modal */}
      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] z-10 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="flex items-start justify-between p-5 sm:p-6 border-b border-slate-200 bg-slate-50/70">
          <div className="space-y-2 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              {/* Badge de Línea Temática */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                <Tag className="w-3.5 h-3.5" />
                {article.thematic_line}
              </span>

              {/* Badge de Estado del Artículo */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
              >
                <StatusIcon className="w-3.5 h-3.5" />
                {statusConfig.label}
              </span>

              <span className="text-xs text-slate-400 font-mono">
                ID #{article.id}
              </span>
            </div>

            <h2
              id="article-detail-title"
              className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 leading-snug tracking-tight text-left"
            >
              {article.title}
            </h2>
          </div>

          {/* Botón de cierre (X) */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal de detalle"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal con scroll */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto text-left">
          {/* Metadatos Rápidos: Fecha y Autor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Fecha de Postulación
                </span>
                <span className="font-medium text-slate-800">{formattedDate}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Visibilidad y Estado
                </span>
                <span className="font-medium text-slate-800">
                  {article.is_enabled ? 'Artículo Activo en Conferencia' : 'Artículo Deshabilitado'}
                </span>
              </div>
            </div>
          </div>

          {/* Resumen / Abstract */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              Resumen (Abstract)
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs text-justify">
              {article.abstract}
            </p>
          </div>

          {/* Palabras Clave */}
          {keywordsList.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Palabras Clave
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {keywordsList.map((kw, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Autor Principal */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500" />
              Autor Principal (Responsable)
            </h3>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 text-sm">
                    {article.responsible_author.full_name}
                  </span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200/60">
                    Autor de Correspondencia
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{article.responsible_author.affiliation}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <a
                      href={`mailto:${article.responsible_author.email}`}
                      className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                    >
                      {article.responsible_author.email}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Coautores */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              Coautores del Manuscrito ({article.coauthors.length})
            </h3>

            {article.coauthors.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                Este artículo no tiene coautores adicionales registrados.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {article.coauthors.map((coauthor) => (
                  <div
                    key={coauthor.id}
                    className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 text-xs">
                        {coauthor.full_name}
                      </span>
                      {coauthor.is_corresponding_author && (
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                          Correspondencia
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{coauthor.affiliation}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <a
                        href={`mailto:${coauthor.email}`}
                        className="text-indigo-600 hover:underline truncate"
                      >
                        {coauthor.email}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Visor PDF embebido */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                Manuscrito Adjunto (Visor de PDF)
              </h3>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline self-start sm:self-auto"
              >
                <span>Abrir manuscrito en pestaña nueva</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shadow-inner">
              <iframe
                src={pdfUrl}
                title={`Manuscrito PDF: ${article.title}`}
                className="w-full h-80 sm:h-96 md:h-[460px] bg-white"
              >
                <p className="p-4 text-xs text-slate-500 text-center">
                  Tu navegador no soporta visualización directa de PDF en el iframe.{' '}
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 font-semibold underline"
                  >
                    Haz clic aquí para descargar o visualizar el documento.
                  </a>
                </p>
              </iframe>
            </div>
            <p className="text-[11px] text-slate-400 italic">
              * El documento se renderiza en modo seguro de solo lectura para la revisión del Comité Científico.
            </p>
          </div>

          {canManagePdf && (
            <PdfVersionManager
              article={article}
              token={token}
              currentPdfUrl={pdfUrl}
              localVersions={localVersions}
              onCurrentPdfUrlChange={handleCurrentPdfUrlChange}
              onLocalVersionsChange={setLocalVersions}
            />
          )}
        </div>

        {/* Footer del Modal */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400 hidden sm:inline">
            Presiona <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">Esc</kbd> para salir
          </span>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver PDF completo</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-xs"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
