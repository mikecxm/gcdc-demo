import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/SessionContext';
import {
  HU13_DEMO_UPDATED_EVENT,
  getArticleEvaluationSummary,
  getReviewApiErrorMessage,
  isHu13DemoMode,
} from '../../services/reviewsService';
import type { EvaluationSummary } from '../../types/reviews';

interface ArticleEvaluationsSummaryProps {
  articleId: number;
}

export const ArticleEvaluationsSummary = ({
  articleId,
}: ArticleEvaluationsSummaryProps) => {
  const { session } = useAuth();
  const role = session?.activeRole;
  const [result, setResult] = useState<{
    articleId: number;
    summary?: EvaluationSummary;
    error?: string;
  } | null>(null);
  const isCurrentResult = result?.articleId === articleId;
  const summary = isCurrentResult ? result?.summary : null;
  const error = isCurrentResult ? result?.error : null;
  const isLoading = !isCurrentResult;

  useEffect(() => {
    if (role !== 'AUTOR' && role !== 'COMITE') return;

    let active = true;
    const loadSummary = () => {
      getArticleEvaluationSummary(articleId)
        .then((summary) => {
          if (active) setResult({ articleId, summary });
        })
        .catch((cause: unknown) => {
          if (active) {
            setResult({ articleId, error: getReviewApiErrorMessage(cause) });
          }
        });
    };
    loadSummary();
    window.addEventListener(HU13_DEMO_UPDATED_EVENT, loadSummary);

    return () => {
      active = false;
      window.removeEventListener(HU13_DEMO_UPDATED_EVENT, loadSummary);
    };
  }, [articleId, role]);

  if (role !== 'AUTOR' && role !== 'COMITE') return null;

  return (
    <section
      className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      data-testid="hu13-evaluations-summary"
      aria-labelledby={`hu13-evaluations-heading-${articleId}`}
    >
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600" />
        <h3
          id={`hu13-evaluations-heading-${articleId}`}
          className="text-sm font-bold text-slate-800"
        >
          Resumen de evaluaciones
        </h3>
      </div>

      {isHu13DemoMode() && (
        <p
          className="rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-xs text-indigo-800"
          data-testid="hu13-demo-mode-alert"
          role="status"
        >
          Datos de demostración local; no se guardan en el servidor.
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-slate-500" role="status">
          Consultando progreso...
        </p>
      ) : error ? (
        <p
          className="flex min-w-0 items-start gap-2 break-words rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
          data-testid="hu13-evaluations-summary-error-alert"
          role="status"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : summary ? (
        <>
          <p className="text-sm text-slate-700">
            {summary.completed_count}/{summary.assigned_count} evaluaciones completadas
          </p>
          <div
            className="h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Progreso de evaluaciones"
            aria-valuemin={0}
            aria-valuemax={summary.assigned_count}
            aria-valuenow={summary.completed_count}
            data-testid="hu13-evaluations-progress"
          >
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{
                width:
                  summary.assigned_count > 0
                    ? `${Math.min(
                        100,
                        (summary.completed_count / summary.assigned_count) * 100
                      )}%`
                    : '0%',
              }}
            />
          </div>
          {summary.verdict && (
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                summary.verdict === 'ACEPTADO'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
              data-testid={`hu13-verdict-badge-${articleId}`}
            >
              Dictamen: {summary.verdict === 'ACEPTADO' ? 'Aceptado' : 'Rechazado'}
            </span>
          )}
        </>
      ) : (
        <p className="text-xs text-slate-500" role="status">
          Aún no hay información de evaluación para este artículo.
        </p>
      )}
    </section>
  );
};
