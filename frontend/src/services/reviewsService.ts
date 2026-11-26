import axios from 'axios';
import { apiClient } from './api';
import { getArticlePdf } from './articlesApi';
import type {
  ArticleEvaluation,
  EvaluationDecision,
  EvaluationSummary,
  ReviewerAssignment,
  SubmitEvaluationPayload,
  SubmitEvaluationResponse,
} from '../types/reviews';

export const HU13_DEMO_UPDATED_EVENT = 'symposia:hu13-demo-updated';

interface DemoArticleProgress {
  assignedCount: number;
  votes: EvaluationDecision[];
}

const isHu13DemoMode = (): boolean =>
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('hu13-demo') === '1';

export { isHu13DemoMode };

const demoAssignments: ReviewerAssignment[] = [
  {
    id: 7001,
    article_id: 101,
    article_title: 'Estrategias digitales para fortalecer la educación rural',
    thematic_line: 'Innovación educativa',
    review_deadline: '2026-12-15T23:59:59-05:00',
    version_id: 8101,
    version_number: 2,
    article_status: 'EN_REVISION',
    evaluation: null,
  },
  {
    id: 7002,
    article_id: 102,
    article_title: 'Análisis de datos abiertos en la gestión pública',
    thematic_line: 'Ciencia de datos',
    review_deadline: '2026-12-20T23:59:59-05:00',
    version_id: 8102,
    version_number: 1,
    article_status: 'EN_REVISION',
    evaluation: null,
  },
  {
    id: 7003,
    article_id: 103,
    article_title: 'Sostenibilidad y resiliencia en sistemas urbanos',
    thematic_line: 'Desarrollo sostenible',
    review_deadline: '2026-12-10T23:59:59-05:00',
    version_id: 8103,
    version_number: 3,
    article_status: 'ACEPTADO',
    evaluation: {
      id: 9203,
      version_id: 8103,
      originality_score: 8.5,
      technical_quality_score: 9,
      relevance_score: 8,
      comments: 'El manuscrito presenta un análisis sólido y pertinente.',
      decision: 'ACEPTADO',
      evaluated_at: '2026-11-20T15:00:00-05:00',
    },
  },
];

const demoProgress = new Map<number, DemoArticleProgress>([
  [101, { assignedCount: 3, votes: ['ACEPTADO'] }],
  [102, { assignedCount: 3, votes: ['RECHAZADO'] }],
  [103, { assignedCount: 2, votes: ['ACEPTADO', 'ACEPTADO'] }],
]);

const getDemoVerdict = (votes: EvaluationDecision[]): EvaluationDecision | null => {
  const acceptedVotes = votes.filter((vote) => vote === 'ACEPTADO').length;
  const rejectedVotes = votes.filter((vote) => vote === 'RECHAZADO').length;
  if (acceptedVotes >= 2) return 'ACEPTADO';
  if (rejectedVotes >= 2) return 'RECHAZADO';
  return null;
};

const createDemoPdf = (): Blob => {
  const content =
    'BT /F1 22 Tf 72 720 Td (Manuscrito de demostracion) Tj ' +
    '0 -36 Td /F1 12 Tf (Documento PDF local para revisar el flujo de evaluacion.) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let document = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(document.length);
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = document.length;
  document += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  document += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  document += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([document], { type: 'application/pdf' });
};

export const setHu13DemoMode = (enabled: boolean): void => {
  const url = new URL(window.location.href);
  if (enabled) {
    url.searchParams.set('hu13-demo', '1');
    url.hash = 'evaluaciones';
  } else {
    url.searchParams.delete('hu13-demo');
  }
  window.location.assign(url.toString());
};

export const getReviewerAssignmentPdf = (
  articleId: number,
  signal: AbortSignal,
  versionNumber: number
): Promise<Blob> =>
  isHu13DemoMode()
    ? Promise.resolve(createDemoPdf())
    : getArticlePdf(articleId, signal, versionNumber);

export const getMyReviewerAssignments = async (): Promise<ReviewerAssignment[]> => {
  if (isHu13DemoMode()) {
    return demoAssignments.map((assignment) => ({ ...assignment }));
  }

  const { data } = await apiClient.get<ReviewerAssignment[]>('/reviews/assignments/');
  if (!Array.isArray(data)) {
    throw new Error('El servidor devolvió un formato de asignaciones no válido.');
  }
  return data;
};

export const submitArticleEvaluation = async (
  assignmentId: number,
  payload: SubmitEvaluationPayload
): Promise<SubmitEvaluationResponse> => {
  if (isHu13DemoMode()) {
    const assignment = demoAssignments.find((item) => item.id === assignmentId);
    if (!assignment) {
      throw new Error('No se encontró la asignación de demostración.');
    }
    if (assignment.evaluation) {
      throw new Error('Esta asignación de demostración ya fue evaluada.');
    }

    const evaluation: ArticleEvaluation = {
      id: Date.now(),
      version_id: payload.version_id,
      originality_score: payload.originality_score,
      technical_quality_score: payload.technical_quality_score,
      relevance_score: payload.relevance_score,
      comments: payload.comments,
      decision: payload.decision,
      evaluated_at: new Date().toISOString(),
    };
    const progress = demoProgress.get(assignment.article_id) ?? {
      assignedCount: 3,
      votes: [],
    };
    progress.votes.push(payload.decision);
    demoProgress.set(assignment.article_id, progress);

    const verdict = getDemoVerdict(progress.votes);
    const articleStatus = verdict ?? 'EN_REVISION';
    const assignmentIndex = demoAssignments.findIndex((item) => item.id === assignmentId);
    demoAssignments[assignmentIndex] = {
      ...assignment,
      evaluation,
      article_status: articleStatus,
    };

    window.dispatchEvent(new Event(HU13_DEMO_UPDATED_EVENT));
    return {
      evaluation,
      article_status: articleStatus,
      verdict,
    };
  }

  const { data } = await apiClient.post<SubmitEvaluationResponse>(
    `/reviews/assignments/${assignmentId}/evaluation/`,
    payload
  );
  return data;
};

export const getArticleEvaluationSummary = async (
  articleId: number
): Promise<EvaluationSummary> => {
  if (isHu13DemoMode()) {
    const progress = demoProgress.get(articleId) ?? { assignedCount: 3, votes: [] };
    const verdict = getDemoVerdict(progress.votes);
    return {
      article_id: articleId,
      assigned_count: progress.assignedCount,
      completed_count: progress.votes.length,
      verdict,
      article_status: verdict ?? 'EN_REVISION',
    };
  }

  const { data } = await apiClient.get<EvaluationSummary>(
    `/reviews/articles/${articleId}/evaluations/summary/`
  );
  return data;
};

export const getReviewApiErrorMessage = (error: unknown): string => {
  if (!axios.isAxiosError(error)) {
    return 'No se pudo completar la evaluación. Inténtalo nuevamente.';
  }

  if (!error.response) {
    return 'No pudimos conectar con el servicio. Verifica tu conexión e inténtalo de nuevo.';
  }

  const responseData: unknown = error.response.data;
  if (typeof responseData === 'object' && responseData !== null) {
    const detail = (responseData as Record<string, unknown>).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.filter((item): item is string => typeof item === 'string').join(' · ');
    }
  }

  switch (error.response.status) {
    case 400:
      return 'La evaluación no se pudo guardar: revisa los datos o la fecha límite.';
    case 403:
      return 'No tienes permiso para evaluar este artículo.';
    case 404:
      return 'No encontramos la información solicitada.';
    default:
      return 'No pudimos completar la solicitud. Inténtalo de nuevo más tarde.';
  }
};
