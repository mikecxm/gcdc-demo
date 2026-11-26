import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CheckCircle2, LoaderCircle, X } from 'lucide-react';
import type {
  EvaluationDecision,
  ReviewerAssignment,
  SubmitEvaluationResponse,
} from '../../types/reviews';
import {
  getReviewApiErrorMessage,
  getReviewerAssignmentPdf,
  submitArticleEvaluation,
} from '../../services/reviewsService';
import PdfViewer from '../articles/PdfViewer';

const evaluationSchema = z.object({
  originality_score: z.number().min(0).max(10),
  technical_quality_score: z.number().min(0).max(10),
  relevance_score: z.number().min(0).max(10),
  comments: z.string().trim().min(1, 'Escribe tus comentarios antes de continuar.'),
  decision: z.enum(['ACEPTADO', 'RECHAZADO']),
});

type EvaluationFormValues = z.infer<typeof evaluationSchema>;

interface ArticleEvaluationModalProps {
  assignment: ReviewerAssignment;
  onClose: () => void;
  onSubmitted: (assignmentId: number, result: SubmitEvaluationResponse) => void;
}

const scoreFields: Array<{
  name: 'originality_score' | 'technical_quality_score' | 'relevance_score';
  label: string;
  testId: string;
}> = [
  { name: 'originality_score', label: 'Originalidad', testId: 'originalidad' },
  { name: 'technical_quality_score', label: 'Calidad técnica', testId: 'calidad-tecnica' },
  { name: 'relevance_score', label: 'Pertinencia', testId: 'pertinencia' },
];

const isDeadlineExpired = (deadline: string): boolean => {
  const date = deadline.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return true;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts > date;
};

export const ArticleEvaluationModal = ({
  assignment,
  onClose,
  onSubmitted,
}: ArticleEvaluationModalProps) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const deadlineExpired = isDeadlineExpired(assignment.review_deadline);
  const alreadyEvaluated = assignment.evaluation !== null;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EvaluationFormValues>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: {
      comments: '',
      decision: 'ACEPTADO',
    },
  });
  const selectedDecision = watch('decision');

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    const controller = new AbortController();
    setIsLoadingPdf(true);
    setPdfError(null);
    getReviewerAssignmentPdf(
      assignment.article_id,
      controller.signal,
      assignment.version_number
    )
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (active && !controller.signal.aborted) {
          setPdfError(getReviewApiErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) setIsLoadingPdf(false);
      });

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assignment.article_id, assignment.version_number]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isSubmitting, onClose]);

  const submitEvaluation = async (values: EvaluationFormValues) => {
    if (deadlineExpired || alreadyEvaluated) return;
    if (!window.confirm('¿Confirmas el envío definitivo de esta evaluación?')) return;

    setSubmitError(null);
    setSuccessMessage(null);
    try {
      const result = await submitArticleEvaluation(assignment.id, {
        ...values,
        version_id: assignment.version_id,
      });
      onSubmitted(assignment.id, result);
      setSuccessMessage('La evaluación se envió correctamente.');
    } catch (error: unknown) {
      setSubmitError(getReviewApiErrorMessage(error));
    }
  };

  const decisionLabel = (decision: EvaluationDecision) =>
    decision === 'ACEPTADO' ? 'Aceptar' : 'Rechazar';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-sm sm:p-5"
      data-testid="hu13-evaluation-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hu13-evaluation-title"
    >
      <div className="my-auto flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/70 p-4 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Evaluación por criterios
            </p>
            <h2
              id="hu13-evaluation-title"
              className="mt-1 break-words text-lg font-bold text-slate-900 sm:text-xl"
            >
              {assignment.article_title}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Versión {assignment.version_number} · {assignment.thematic_line}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancelar evaluación"
            data-testid="hu13-cancel-evaluation-btn"
            className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          {isLoadingPdf ? (
            <p className="mb-5 text-sm text-slate-500" role="status">
              Cargando manuscrito...
            </p>
          ) : pdfError ? (
            <p
              className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
              data-testid="hu13-pdf-error-alert"
              role="alert"
            >
              {pdfError}
            </p>
          ) : pdfUrl ? (
            <div className="mb-6 min-w-0" data-testid="hu13-assignment-pdf-viewer">
              <PdfViewer pdfUrl={pdfUrl} title={assignment.article_title} />
            </div>
          ) : null}

          {deadlineExpired && !alreadyEvaluated && (
            <p
              className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              data-testid="hu13-deadline-alert"
              role="alert"
            >
              El plazo para evaluar este artículo venció. El formulario está bloqueado.
            </p>
          )}

          {submitError && (
            <p
              className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
              data-testid="hu13-evaluation-error-alert"
              role="alert"
            >
              {submitError}
            </p>
          )}
          {successMessage && (
            <p
              className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
              data-testid="hu13-evaluation-success-alert"
              role="status"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {successMessage}
            </p>
          )}

          {alreadyEvaluated ? (
            <section
              className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4"
              data-testid="hu13-evaluation-submitted-summary"
            >
              <h3 className="text-sm font-bold text-slate-800">Evaluación enviada</h3>
              <p className="text-sm text-slate-700">
                Originalidad {assignment.evaluation?.originality_score}/10 · Calidad técnica{' '}
                {assignment.evaluation?.technical_quality_score}/10 · Pertinencia{' '}
                {assignment.evaluation?.relevance_score}/10
              </p>
              <p className="break-words text-sm text-slate-600">
                {assignment.evaluation?.comments}
              </p>
              <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                Dictamen: {assignment.evaluation && decisionLabel(assignment.evaluation.decision)}
              </span>
            </section>
          ) : (
            <form
              className="space-y-5"
              onSubmit={handleSubmit(submitEvaluation)}
              noValidate
            >
              <fieldset
                className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3"
                disabled={deadlineExpired || isSubmitting}
              >
                <legend className="mb-3 text-sm font-bold text-slate-800">
                  Rúbrica (escala de 0 a 10)
                </legend>
                {scoreFields.map(({ name, label, testId }) => (
                  <label key={name} className="min-w-0 space-y-1.5">
                    <span className="block text-xs font-semibold text-slate-700">{label}</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      inputMode="decimal"
                      data-testid={`hu13-rubric-input-${testId}`}
                      aria-invalid={Boolean(errors[name])}
                      aria-describedby={`${name}-error`}
                      {...register(name, { valueAsNumber: true })}
                      className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                    {errors[name] && (
                      <span id={`${name}-error`} className="block text-xs text-rose-700">
                        Ingresa una puntuación entre 0 y 10.
                      </span>
                    )}
                  </label>
                ))}
              </fieldset>

              <label className="block space-y-1.5">
                <span className="block text-xs font-semibold text-slate-700">
                  Comentarios para autores
                </span>
                <textarea
                  rows={5}
                  disabled={deadlineExpired || isSubmitting}
                  data-testid="hu13-comments-textarea"
                  aria-invalid={Boolean(errors.comments)}
                  aria-describedby="hu13-comments-error"
                  {...register('comments')}
                  className="w-full min-w-0 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Escribe observaciones claras y constructivas..."
                />
                {errors.comments && (
                  <span
                    id="hu13-comments-error"
                    className="block text-xs text-rose-700"
                  >
                    {errors.comments.message}
                  </span>
                )}
              </label>

              <fieldset
                className="space-y-2"
                disabled={deadlineExpired || isSubmitting}
              >
                <legend className="text-xs font-semibold text-slate-700">
                  Dictamen individual
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(['ACEPTADO', 'RECHAZADO'] as const).map((decision) => (
                    <button
                      key={decision}
                      type="button"
                      aria-pressed={selectedDecision === decision}
                      data-testid={
                        decision === 'ACEPTADO'
                          ? 'hu13-vote-accept-btn'
                          : 'hu13-vote-reject-btn'
                      }
                      onClick={() => setValue('decision', decision, { shouldValidate: true })}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        selectedDecision === decision
                          ? decision === 'ACEPTADO'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border-rose-300 bg-rose-50 text-rose-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {decisionLabel(decision)}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  data-testid="hu13-cancel-evaluation-form-btn"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={deadlineExpired || isSubmitting}
                  data-testid="hu13-submit-evaluation-btn"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Enviando...' : 'Enviar evaluación definitiva'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
