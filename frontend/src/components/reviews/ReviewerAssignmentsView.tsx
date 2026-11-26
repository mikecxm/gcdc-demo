import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ClipboardCheck, FileText, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/SessionContext';
import {
  getMyReviewerAssignments,
  getReviewApiErrorMessage,
  isHu13DemoMode,
  setHu13DemoMode,
} from '../../services/reviewsService';
import type {
  AssignmentFilter,
  EvaluationDecision,
  ReviewerAssignment,
  SubmitEvaluationResponse,
} from '../../types/reviews';
import { ArticleEvaluationModal } from './ArticleEvaluationModal';

const EMPTY_ASSIGNMENTS: ReviewerAssignment[] = [];

const formatDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
};

const isVerdict = (status: string): status is EvaluationDecision =>
  status === 'ACEPTADO' || status === 'RECHAZADO';

export const ReviewerAssignmentsView = () => {
  const { isAuthenticated, session } = useAuth();
  const [assignmentResult, setAssignmentResult] = useState<{
    requestId: number;
    assignments: ReviewerAssignment[];
    error: string | null;
  } | null>(null);
  const [filter, setFilter] = useState<AssignmentFilter>('TODOS');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const role = session?.activeRole;
  const canReview = isAuthenticated && role === 'COMITE';
  const demoMode = isHu13DemoMode();
  const isLoading = canReview && assignmentResult?.requestId !== refreshKey;
  const isCurrentResult = assignmentResult?.requestId === refreshKey;
  const assignments =
    isCurrentResult && assignmentResult
      ? assignmentResult.assignments
      : EMPTY_ASSIGNMENTS;
  const loadError =
    isCurrentResult && assignmentResult ? assignmentResult.error : null;

  useEffect(() => {
    if (!canReview) return;

    let active = true;
    getMyReviewerAssignments()
      .then((data) => {
        if (active) {
          setAssignmentResult({ requestId: refreshKey, assignments: data, error: null });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setAssignmentResult({
            requestId: refreshKey,
            assignments: [],
            error: getReviewApiErrorMessage(error),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [canReview, refreshKey]);

  const visibleAssignments = useMemo(
    () =>
      assignments.filter((assignment) => {
        if (filter === 'TODOS') return true;
        return filter === 'EVALUADO'
          ? assignment.evaluation !== null
          : assignment.evaluation === null;
      }),
    [assignments, filter]
  );
  const selectedAssignment =
    assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null;

  const handleEvaluationSubmitted = (
    assignmentId: number,
    result: SubmitEvaluationResponse
  ) => {
    setAssignmentResult((current) => {
      if (!current || current.requestId !== refreshKey) return current;
      return {
        ...current,
        assignments: current.assignments.map((assignment) =>
          assignment.id === assignmentId
            ? {
                ...assignment,
                evaluation: result.evaluation,
                article_status: result.verdict ?? result.article_status,
              }
            : assignment
        ),
      };
    });
  };

  if (!canReview) {
    return (
      <section
        className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"
        data-testid="hu13-reviewer-assignments-view"
        role="alert"
      >
        La bandeja de evaluación está disponible únicamente para miembros de COMITE.
      </section>
    );
  }

  return (
    <section
      className="min-w-0 space-y-6 text-left"
      data-testid="hu13-reviewer-assignments-view"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-600">
            HU-13 · EVALUACIÓN CIENTÍFICA
          </span>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <ClipboardCheck className="h-6 w-6 shrink-0 text-indigo-600" />
            Mis evaluaciones
          </h1>
          <p className="max-w-3xl text-sm text-slate-500">
            Consulta tus artículos asignados, revisa el manuscrito y envía el dictamen.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {import.meta.env.DEV && !demoMode && (
            <button
              type="button"
              onClick={() => setHu13DemoMode(true)}
              data-testid="hu13-enable-demo-btn"
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              Activar datos demo
            </button>
          )}
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={isLoading}
            data-testid="hu13-refresh-assignments-btn"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </header>

      {demoMode && (
        <div
          className="flex min-w-0 flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 sm:flex-row sm:items-center sm:justify-between"
          data-testid="hu13-demo-mode-alert"
          role="status"
        >
          <p>
            Modo demo local activo. Las asignaciones, evaluaciones y el PDF son de muestra;
            los cambios no se guardan en el servidor.
          </p>
          <button
            type="button"
            onClick={() => setHu13DemoMode(false)}
            data-testid="hu13-disable-demo-btn"
            className="shrink-0 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
          >
            Salir del modo demo
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor="hu13-filter-status" className="text-xs font-semibold text-slate-700">
          Estado de la evaluación
        </label>
        <select
          id="hu13-filter-status"
          value={filter}
          onChange={(event) => setFilter(event.target.value as AssignmentFilter)}
          data-testid="hu13-filter-status"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 sm:w-auto"
        >
          <option value="TODOS">Todas</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="EVALUADO">Evaluadas</option>
        </select>
      </div>

      {loadError && (
        <div
          className="flex min-w-0 items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          data-testid="hu13-assignments-error-alert"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="min-w-0 break-words">{loadError}</p>
        </div>
      )}

      {isLoading ? (
        <div
          className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
          data-testid="hu13-assignments-loading"
          role="status"
        >
          Cargando tus asignaciones...
        </div>
      ) : !loadError && assignments.length === 0 ? (
        <div
          className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
          data-testid="hu13-assignments-empty"
          role="status"
        >
          No tienes artículos asignados para evaluar.
        </div>
      ) : !loadError && visibleAssignments.length === 0 ? (
        <div
          className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
          data-testid="hu13-filter-empty"
          role="status"
        >
          No hay asignaciones con el estado seleccionado.
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          {visibleAssignments.map((assignment) => {
            const isEvaluated = assignment.evaluation !== null;
            const verdict = isVerdict(assignment.article_status)
              ? assignment.article_status
              : null;
            return (
              <article
                key={assignment.id}
                className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                data-testid={`hu13-assignment-card-${assignment.article_id}`}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-base font-bold text-slate-900">
                      {assignment.article_title}
                    </p>
                    <p className="mt-1 break-words text-xs text-slate-500">
                      Línea temática: {assignment.thematic_line}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      isEvaluated
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                    }`}
                    data-testid={`hu13-assignment-status-${assignment.article_id}`}
                  >
                    {isEvaluated ? 'Evaluado' : 'Pendiente'}
                  </span>
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-2">
                  <p className="min-w-0 break-words text-slate-600">
                    <span className="font-semibold text-slate-700">Fecha límite: </span>
                    {formatDate(assignment.review_deadline)}
                  </p>
                  <p className="min-w-0 break-words text-slate-600">
                    <span className="font-semibold text-slate-700">Manuscrito: </span>
                    Versión {assignment.version_number}
                  </p>
                </div>

                {verdict && (
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                      verdict === 'ACEPTADO'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                    data-testid={`hu13-verdict-badge-${assignment.article_id}`}
                  >
                    Dictamen: {verdict === 'ACEPTADO' ? 'Aceptado' : 'Rechazado'}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedAssignmentId(assignment.id)}
                  data-testid={`hu13-open-evaluate-btn-${assignment.article_id}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  <FileText className="h-4 w-4" />
                  {isEvaluated ? 'Ver evaluación' : 'Evaluar artículo'}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {selectedAssignment && (
        <ArticleEvaluationModal
          assignment={selectedAssignment}
          onClose={() => setSelectedAssignmentId(null)}
          onSubmitted={handleEvaluationSubmitted}
        />
      )}
    </section>
  );
};
