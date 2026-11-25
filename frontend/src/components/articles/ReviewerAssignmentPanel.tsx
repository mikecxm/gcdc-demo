import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ClipboardCheck,
  Users,
} from 'lucide-react';
import {
  getArticles,
  assignReviewers,
  getReviewerSuggestions,
} from '../../services/articlesApi';
import type { Article, CommitteeMember } from '../../types/article';
import { useAuth } from '../../context/SessionContext';

const workloadLabel = (count: number): string =>
  `${count} ${count === 1 ? 'artículo asignado' : 'artículos asignados'}`;

/**
 * Parse the error body returned by the backend.
 * `detail` can be a string or an array of strings (conflict list).
 */
const parseApiError = (error: any): string => {
  const data = error?.response?.data;
  if (data) {
    const detail = data.detail;
    if (Array.isArray(detail)) {
      return detail.join(' · ');
    }
    if (typeof detail === 'string') {
      return detail;
    }
    // DRF validation errors can be nested under field names
    const values = Object.values(data).flat();
    if (values.length > 0) {
      return values.filter((v): v is string => typeof v === 'string').join(' · ');
    }
  }
  return error?.message || 'Error al realizar la asignación en el servidor.';
};

export const ReviewerAssignmentPanel: React.FC = () => {
  const { isAuthenticated, session } = useAuth();
  const role = session?.activeRole;
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<number[]>([]);
  const [assignments, setAssignments] = useState<Record<number, number[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Candidates loaded from the backend for the selected article
  const [candidates, setCandidates] = useState<CommitteeMember[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);

  // ───── Load submitted articles on mount ─────
  useEffect(() => {
    let isCurrent = true;
    getArticles()
      .then((response) => {
        if (!isCurrent) return;
        const submittedArticles = response.data.filter(
          (article) => article.is_enabled && article.status === 'POSTULADO'
        );
        setArticles(submittedArticles);
        setSelectedArticleId(submittedArticles[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : 'No fue posible cargar los artículos postulados.'
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoadingArticles(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  // ───── Load reviewer suggestions when the selected article changes ─────
  useEffect(() => {
    if (!selectedArticleId) {
      setCandidates([]);
      return;
    }

    let isCurrent = true;
    setIsLoadingCandidates(true);
    setCandidatesError(null);

    getReviewerSuggestions(selectedArticleId)
      .then((data) => {
        if (!isCurrent) return;
        setCandidates(data);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setCandidates([]);
        setCandidatesError(parseApiError(error));
      })
      .finally(() => {
        if (isCurrent) setIsLoadingCandidates(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedArticleId]);

  const selectedArticle =
    articles.find((article) => article.id === selectedArticleId) ?? null;

  // Sort candidates: lower workload first, higher thematic affinity first
  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      const aWorkload = a.current_assignments ?? 0;
      const bWorkload = b.current_assignments ?? 0;
      if (aWorkload !== bWorkload) return aWorkload - bWorkload;
      const aAffinity = a.thematic_affinity ?? 0;
      const bAffinity = b.thematic_affinity ?? 0;
      if (aAffinity !== bAffinity) return bAffinity - aAffinity;
      return (a.full_name ?? '').localeCompare(b.full_name ?? '', 'es');
    });
  }, [candidates]);

  const canManageAssignments =
    isAuthenticated && (role === 'ADMIN' || role === 'COMITE');

  if (!canManageAssignments) {
    return (
      <div
        className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"
        role="alert"
      >
        Este panel está disponible únicamente para ADMIN y COMITE.
      </div>
    );
  }

  const handleSelectArticle = (article: Article) => {
    setSelectedArticleId(article.id);
    setSelectedReviewerIds(assignments[article.id] ?? []);
    setSaveMessage(null);
  };

  const handleToggleReviewer = (reviewerId: number) => {
    setSelectedReviewerIds((current) => {
      if (current.includes(reviewerId)) {
        return current.filter((id) => id !== reviewerId);
      }
      if (current.length >= 3) return current;
      return [...current, reviewerId];
    });
    setSaveMessage(null);
  };

  const handleSaveAssignment = async () => {
    if (!selectedArticle || selectedReviewerIds.length !== 3 || isSaving) return;

    setIsSaving(true);
    setSaveMessage(null);
    const nextIds = [...selectedReviewerIds];

    try {
      await assignReviewers({
        article_id: selectedArticle.id,
        reviewer_ids: nextIds,
      });

      setAssignments((current) => ({
        ...current,
        [selectedArticle.id]: nextIds,
      }));

      // Update article status in the UI to EN_REVISION
      setArticles((current) =>
        current.map((art) =>
          art.id === selectedArticle.id
            ? { ...art, status: 'EN_REVISION' as const }
            : art
        )
      );

      setSaveMessage({
        text: 'Los 3 jurados fueron asignados con éxito y el artículo cambió al estado EN_REVISION.',
        isError: false,
      });
    } catch (error: any) {
      // Never save locally on failure — show the real server error
      const errorMsg = parseApiError(error);
      setSaveMessage({ text: errorMsg, isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="min-w-0 space-y-6 text-left">
      <header className="space-y-2">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-600">
          HU-12 · GESTIÓN EDITORIAL
        </span>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <ClipboardCheck className="h-6 w-6 flex-shrink-0 text-indigo-600" />
          Asignación de jurados
        </h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Selecciona exactamente tres miembros del comité para cada artículo postulado.
          Se excluyen automáticamente autores y coautores.
        </p>
      </header>

      {loadError && (
        <div
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
          role="alert"
        >
          {loadError}
        </div>
      )}

      {isLoadingArticles ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Cargando artículos postulados...
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No hay artículos postulados que requieran asignación de jurados.
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <section className="min-w-0 space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Users className="h-4 w-4 text-slate-500" />
              Artículos postulados ({articles.length})
            </h2>
            <div className="space-y-2">
              {articles.map((article) => {
                const assignmentCount = assignments[article.id]?.length ?? 0;
                const isAssigned = assignmentCount === 3;
                const isSelected = article.id === selectedArticleId;
                return (
                  <button
                    key={article.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectArticle(article)}
                    className={`w-full min-w-0 rounded-xl border p-4 text-left transition-colors ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-indigo-200'
                    }`}
                  >
                    <span className="block break-words text-sm font-semibold text-slate-900">
                      {article.title}
                    </span>
                    <span className="mt-2 block break-words text-xs text-slate-600">
                      Autor: {article.responsible_author.full_name}
                    </span>
                    {(article.coauthors ?? []).length > 0 && (
                      <span className="mt-1 block break-words text-xs text-slate-500">
                        Coautores: {article.coauthors.map((author) => author.full_name).join(', ')}
                      </span>
                    )}
                    <span className="mt-2 block break-words text-xs text-slate-500">
                      Línea temática: {article.thematic_line}
                    </span>
                    <span
                      className={`mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        isAssigned
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isAssigned ? (
                        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      )}
                      {isAssigned ? '3 jurados asignados' : 'Pendiente de jurados'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {selectedArticle && (
            <section className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Selección para el manuscrito
                </span>
                <h2 className="mt-1 break-words text-base font-bold text-slate-900">
                  {selectedArticle.title}
                </h2>
                <p className="mt-1 break-words text-xs text-slate-500">
                  {selectedArticle.thematic_line}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3">
                <span className="text-sm font-semibold text-slate-800">
                  Seleccionados: {selectedReviewerIds.length} / 3
                </span>
                <span className="text-[11px] text-slate-500">
                  {isLoadingCandidates
                    ? 'Cargando candidatos...'
                    : `${sortedCandidates.length} candidatos elegibles`}
                </span>
              </div>

              {isLoadingCandidates ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Consultando sugerencias del backend...
                </div>
              ) : candidatesError ? (
                <div
                  className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
                  role="alert"
                >
                  {candidatesError}
                </div>
              ) : sortedCandidates.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  No se encontraron candidatos elegibles para este artículo. Verifica que haya
                  miembros del comité activos que no sean autores ni coautores.
                </div>
              ) : (
                <div className="max-h-[28rem] min-w-0 space-y-2 overflow-y-auto">
                  {sortedCandidates.map((member) => {
                    const isSelected = selectedReviewerIds.includes(member.id);
                    const hasAffinity = (member.thematic_affinity ?? 0) > 0;
                    const workload = member.current_assignments ?? 0;
                    return (
                      <label
                        key={member.id}
                        className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                          isSelected
                            ? 'border-indigo-300 bg-indigo-50'
                            : 'border-slate-200 hover:border-indigo-200'
                        } ${
                          !isSelected && selectedReviewerIds.length >= 3
                            ? 'cursor-not-allowed opacity-60'
                            : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!isSelected && selectedReviewerIds.length >= 3}
                          onChange={() => handleToggleReviewer(member.id)}
                          className="mt-1 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-semibold text-slate-800">
                            {member.full_name}
                          </span>
                          <span className="block break-all text-xs text-slate-500">
                            {member.email}
                          </span>
                          {member.affiliation && (
                            <span className="block break-words text-xs text-slate-400">
                              {member.affiliation}
                            </span>
                          )}
                          <span className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
                                hasAffinity
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {hasAffinity && <Award className="h-3 w-3" />}
                              {hasAffinity ? 'Afinidad temática' : 'Otra área'}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600">
                              {workloadLabel(workload)}
                            </span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {selectedReviewerIds.length !== 3 && (
                <p className="text-xs text-amber-800" role="status">
                  Se requieren exactamente 3 jurados distintos para guardar la asignación.
                </p>
              )}
              {saveMessage && (
                <p
                  className={`rounded-lg border p-3 text-xs ${
                    saveMessage.isError
                      ? 'border-rose-200 bg-rose-50 text-rose-800'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  }`}
                  role="status"
                >
                  {saveMessage.text}
                </p>
              )}
              <button
                type="button"
                onClick={handleSaveAssignment}
                disabled={
                  selectedReviewerIds.length !== 3 ||
                  isSaving ||
                  selectedArticle.status !== 'POSTULADO'
                }
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSaving
                  ? 'Guardando...'
                  : selectedArticle.status !== 'POSTULADO'
                  ? `Artículo en estado ${selectedArticle.status}`
                  : 'Guardar asignación'}
              </button>
            </section>
          )}
        </div>
      )}
    </section>
  );
};
