import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle, XCircle } from 'lucide-react';
import type { Article } from '../../types/article';
import {
  getArticleApiErrorMessage,
  getThematicLines,
  updateArticleMetadata,
  type ThematicLine,
} from '../../services/articlesApi';

const metadataSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio.').max(255, 'Máximo 255 caracteres.'),
  abstract: z.string().trim().min(1, 'El resumen es obligatorio.'),
  keywords: z.string().trim().min(1, 'Las palabras clave son obligatorias.').max(255, 'Máximo 255 caracteres.'),
  thematic_line_id: z.coerce.number().int().positive('Selecciona una línea temática válida.'),
});

type MetadataFormData = z.infer<typeof metadataSchema>;

const getBogotaCalendarDate = (): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
};

interface ArticleMetadataEditFormProps {
  article: Article;
  isOwner: boolean;
  onCancel: () => void;
  onUpdated: (article: Article) => void;
}

export const ArticleMetadataEditForm: React.FC<ArticleMetadataEditFormProps> = ({
  article,
  isOwner,
  onCancel,
  onUpdated,
}) => {
  const [thematicLines, setThematicLines] = useState<ThematicLine[]>([]);
  const [isLoadingThematicLines, setIsLoadingThematicLines] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [thematicLinesAttempt, setThematicLinesAttempt] = useState(0);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [todayInBogota, setTodayInBogota] = useState(getBogotaCalendarDate);

  const deadline = article.submission_deadline;
  const deadlineExpired = deadline ? deadline < todayInBogota : false;

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<MetadataFormData>({
    resolver: zodResolver(metadataSchema),
    mode: 'onChange',
    defaultValues: {
      title: article.title,
      abstract: article.abstract,
      keywords: article.keywords,
      thematic_line_id: article.thematic_line_id,
    },
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTodayInBogota(getBogotaCalendarDate());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    reset({
      title: article.title,
      abstract: article.abstract,
      keywords: article.keywords,
      thematic_line_id: article.thematic_line_id,
    });
  }, [
    article.id,
    article.title,
    article.abstract,
    article.keywords,
    article.thematic_line_id,
    reset,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingThematicLines(true);
    setLoadError(null);
    getThematicLines(controller.signal)
      .then((lines) => {
        setThematicLines(lines);
        if (!article.thematic_line_id) {
          const matchingLine = lines.find((line) => line.name === article.thematic_line);
          if (matchingLine) setValue('thematic_line_id', matchingLine.id, { shouldValidate: true });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(getArticleApiErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingThematicLines(false);
      });
    return () => controller.abort();
  }, [
    article.thematic_line,
    article.thematic_line_id,
    thematicLinesAttempt,
    setValue,
  ]);

  useEffect(() => {
    if (!errorToast) return;
    const timer = window.setTimeout(() => setErrorToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [errorToast]);

  const onSubmit = async (data: MetadataFormData) => {
    setErrorToast(null);
    try {
      const updated = await updateArticleMetadata(article.id, data);
      onUpdated(updated);
    } catch (error: unknown) {
      setErrorToast(getArticleApiErrorMessage(error));
    }
  };

  const blocked = !isOwner || deadlineExpired;

  return (
    <div className="relative">
      {errorToast && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed top-5 right-5 z-[9999] max-w-sm rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 shadow-xl flex gap-3"
        >
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1 text-xs">{errorToast}</div>
          <button type="button" aria-label="Cerrar notificación" onClick={() => setErrorToast(null)}>×</button>
        </div>
      )}

      {blocked && (
        <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {!isOwner
            ? 'Solo el autor responsable puede editar los metadatos de este artículo.'
            : `La edición está bloqueada porque venció el plazo (${article.submission_deadline}).`}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Formulario de edición de metadatos">
        <fieldset disabled={blocked || isSubmitting} className="space-y-4">
          <div>
            <label htmlFor="metadata-title" className="block text-xs font-semibold text-slate-700 mb-1.5">Título</label>
            <input
              id="metadata-title"
              type="text"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'metadata-title-error' : undefined}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-600 focus:outline-none"
              {...register('title')}
            />
            {errors.title && <p id="metadata-title-error" role="alert" className="mt-1 text-xs text-rose-600">{errors.title.message}</p>}
          </div>

          <div>
            <label htmlFor="metadata-abstract" className="block text-xs font-semibold text-slate-700 mb-1.5">Resumen</label>
            <textarea
              id="metadata-abstract"
              rows={5}
              aria-invalid={Boolean(errors.abstract)}
              aria-describedby={errors.abstract ? 'metadata-abstract-error' : undefined}
              className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-600 focus:outline-none"
              {...register('abstract')}
            />
            {errors.abstract && <p id="metadata-abstract-error" role="alert" className="mt-1 text-xs text-rose-600">{errors.abstract.message}</p>}
          </div>

          <div>
            <label htmlFor="metadata-keywords" className="block text-xs font-semibold text-slate-700 mb-1.5">Palabras clave</label>
            <input
              id="metadata-keywords"
              type="text"
              aria-invalid={Boolean(errors.keywords)}
              aria-describedby={errors.keywords ? 'metadata-keywords-error' : 'metadata-keywords-help'}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-600 focus:outline-none"
              {...register('keywords')}
            />
            <p id="metadata-keywords-help" className="mt-1 text-[11px] text-slate-500">Separa las palabras clave con comas.</p>
            {errors.keywords && <p id="metadata-keywords-error" role="alert" className="mt-1 text-xs text-rose-600">{errors.keywords.message}</p>}
          </div>

          <div>
            <label htmlFor="metadata-thematic-line" className="block text-xs font-semibold text-slate-700 mb-1.5">Línea temática</label>
            {isLoadingThematicLines ? (
              <p role="status" className="text-xs text-slate-500">Cargando líneas temáticas...</p>
            ) : loadError ? (
              <div role="alert" className="space-y-2 text-xs text-rose-600">
                <p>No se pudieron cargar las líneas temáticas: {loadError}</p>
                <button
                  type="button"
                  onClick={() => setThematicLinesAttempt((attempt) => attempt + 1)}
                  className="font-semibold underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Reintentar carga de líneas temáticas
                </button>
              </div>
            ) : thematicLines.length === 0 ? (
              <p role="status" className="text-xs text-amber-700">
                No hay líneas temáticas disponibles; no es posible cambiar este campo ahora.
              </p>
            ) : (
              <select
                id="metadata-thematic-line"
                aria-invalid={Boolean(errors.thematic_line_id)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-600 focus:outline-none"
                {...register('thematic_line_id')}
              >
                {thematicLines.map((line) => (
                  <option key={line.id} value={line.id}>{line.name}</option>
                ))}
              </select>
            )}
            {errors.thematic_line_id && <p role="alert" className="mt-1 text-xs text-rose-600">{errors.thematic_line_id.message}</p>}
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-700 mb-1.5">Coautores (solo lectura)</h3>
            {article.coauthors.length ? (
              <ul className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                {article.coauthors.map((coauthor) => (
                  <li key={coauthor.id}>{coauthor.full_name} — {coauthor.email}</li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500">Sin coautores registrados.</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={!isDirty || isSubmitting || blocked} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              {isSubmitting && <LoaderCircle className="w-4 h-4 animate-spin" />}
              Guardar cambios
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
};
