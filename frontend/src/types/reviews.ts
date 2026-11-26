export type EvaluationDecision = 'ACEPTADO' | 'RECHAZADO';
export type EvaluationArticleStatus =
  | 'EN_REVISION'
  | 'ACEPTADO'
  | 'RECHAZADO';
export type AssignmentEvaluationState = 'PENDIENTE' | 'EVALUADO';
export type AssignmentFilter = 'TODOS' | AssignmentEvaluationState;

export interface ArticleEvaluation {
  id: number;
  version_id: number;
  originality_score: number;
  technical_quality_score: number;
  relevance_score: number;
  comments: string;
  decision: EvaluationDecision;
  evaluated_at: string;
}

export interface ReviewerAssignment {
  id: number;
  article_id: number;
  article_title: string;
  thematic_line: string;
  review_deadline: string;
  version_id: number;
  version_number: number;
  article_status: EvaluationArticleStatus;
  evaluation: ArticleEvaluation | null;
}

export interface SubmitEvaluationPayload {
  version_id: number;
  originality_score: number;
  technical_quality_score: number;
  relevance_score: number;
  comments: string;
  decision: EvaluationDecision;
}

export interface EvaluationSummary {
  article_id: number;
  assigned_count: number;
  completed_count: number;
  verdict: EvaluationDecision | null;
  article_status: EvaluationArticleStatus;
}

export interface SubmitEvaluationResponse {
  evaluation: ArticleEvaluation;
  article_status: EvaluationArticleStatus;
  verdict: EvaluationDecision | null;
}
