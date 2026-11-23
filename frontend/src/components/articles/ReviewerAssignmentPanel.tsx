import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ClipboardCheck,
  Users,
} from 'lucide-react';
<<<<<<< HEAD
import {
  getArticles,
  MOCK_COMMITTEE_MEMBERS,
  assignReviewers,
  getCommitteeMembers,
} from '../../services/articlesApi';
=======
import { getArticles, MOCK_COMMITTEE_MEMBERS } from '../../services/articlesApi';
>>>>>>> c4eba67dae7dfa8dbfa02fcd10e087eca0204beb
import type { Article, CommitteeMember } from '../../types/article';
import { useAuth } from '../../context';

const normalizeName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const hasConflictOfInterest = (member: CommitteeMember, article: Article): boolean => {
  const authors = [
    article.responsible_author,
    ...(article.coauthors ?? []),
  ];
  const authorIds = new Set(authors.map((author) => author.id).filter((id) => id != null));
  const authorEmails = new Set(
    authors.map((author) => normalizeEmail(author.email)).filter(Boolean)
  );
  const authorNames = new Set(
    authors.map((author) => normalizeName(author.full_name)).filter(Boolean)
  );

  return (
    authorIds.has(member.id) ||
    authorEmails.has(normalizeEmail(member.email)) ||
    authorNames.has(normalizeName(member.full_name))
  );
};

const workloadLabel = (count: number): string =>
  `${count} ${count === 1 ? 'artículo asignado' : 'artículos asignados'}`;

export const ReviewerAssignmentPanel: React.FC = () => {
  const { isAuthenticated, role } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [isFallbackData, setIsFallbackData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<number[]>([]);
  const [assignments, setAssignments] = useState<Record<number, number[]>>({});
  const [workloadAdjustments, setWorkloadAdjustments] = useState<Record<number, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

<<<<<<< HEAD
  const [committeeMembersList, setCommitteeMembersList] = useState<CommitteeMember[]>(() =>
    MOCK_COMMITTEE_MEMBERS.filter((member) => member.roles.includes('COMITE'))
  );

=======
>>>>>>> c4eba67dae7dfa8dbfa02fcd10e087eca0204beb
  useEffect(() => {
    let isCurrent = true;
    getArticles()
      .then((response) => {
        if (!isCurrent) return;
        const submittedArticles = response.data.filter(
          (article) => article.is_enabled && article.status === 'POSTULADO'
        );
        setArticles(submittedArticles);
        setIsFallbackData(response.isFallback);
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

<<<<<<< HEAD
    getCommitteeMembers()
      .then((members) => {
        if (!isCurrent) return;
        if (members && members.length > 0) {
          setCommitteeMembersList(members.filter((m) => m.roles.includes('COMITE')));
        }
      })
      .catch(() => {});

=======
>>>>>>> c4eba67dae7dfa8dbfa02fcd10e087eca0204beb
    return () => {
      isCurrent = false;
    };
  }, []);

  const selectedArticle =
    articles.find((article) => article.id === selectedArticleId) ?? null;

<<<<<<< HEAD
  const committeeMembers = committeeMembersList;
=======
  const committeeMembers = useMemo(
    () => MOCK_COMMITTEE_MEMBERS.filter((member) => member.roles.includes('COMITE')),
    []
  );
>>>>>>> c4eba67dae7dfa8dbfa02fcd10e087eca0204beb

  const conflictedMembers = useMemo(
    () =>
      selectedArticle
        ? committeeMembers.filter((member) =>
            hasConflictOfInterest(member, selectedArticle)
          )
        : [],
    [committeeMembers, selectedArticle]
  );

  const eligibleMembers = useMemo(() => {
    if (!selectedArticle) return [];
    return committeeMembers
      .filter((member) => !hasConflictOfInterest(member, selectedArticle))
      .sort((first, second) => {
        const firstAffinity = first.thematic_lines.includes(selectedArticle.thematic_line);
        const secondAffinity = second.thematic_lines.includes(selectedArticle.thematic_line);
        if (firstAffinity !== secondAffinity) return firstAffinity ? -1 : 1;
        const firstWorkload =
          first.assigned_article_count + (workloadAdjustments[first.id] ?? 0);
        const secondWorkload =
          second.assigned_article_count + (workloadAdjustments[second.id] ?? 0);
        if (firstWorkload !== secondWorkload) return firstWorkload - secondWorkload;
        return first.full_name.localeCompare(second.full_name, 'es');
      });
  }, [committeeMembers, selectedArticle, workloadAdjustments]);

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

<<<<<<< HEAD
  const handleSaveAssignment = async () => {
    if (!selectedArticle || selectedReviewerIds.length !== 3 || isSaving) return;

    setIsSaving(true);
    setSaveMessage(null);
    const previousIds = assignments[selectedArticle.id] ?? [];
    const nextIds = [...selectedReviewerIds];

    try {
      const result = await assignReviewers({
        article_id: selectedArticle.id,
        reviewer_ids: nextIds,
      });

      setAssignments((current) => ({
        ...current,
        [selectedArticle.id]: nextIds,
      }));
      setWorkloadAdjustments((current) => {
        const next = { ...current };
        previousIds
          .filter((id) => !nextIds.includes(id))
          .forEach((id) => {
            next[id] = (next[id] ?? 0) - 1;
          });
        nextIds
          .filter((id) => !previousIds.includes(id))
          .forEach((id) => {
            next[id] = (next[id] ?? 0) + 1;
          });
        return next;
      });

      // Actualizar el estado del artículo en la interfaz a EN_REVISION
      setArticles((current) =>
        current.map((art) =>
          art.id === selectedArticle.id
            ? { ...art, status: 'EN_REVISION' as const }
            : art
        )
      );

      setSaveMessage(
        result.message ||
          'Los 3 jurados fueron asignados con éxito y el artículo cambió al estado EN_REVISION.'
      );
    } catch (error: any) {
      console.warn('Respuesta al conectar con el endpoint de asignación:', error);
      const errorMsg =
        error.response?.data?.detail ||
        error.message ||
        'Error al realizar la asignación en el servidor.';

      if (typeof errorMsg === 'string' && errorMsg.includes('Conflicto')) {
        setSaveMessage(`Alerta de conflicto: ${errorMsg}`);
      } else {
        // Fallback local en caso de desconexión
        setAssignments((current) => ({
          ...current,
          [selectedArticle.id]: nextIds,
        }));
        setSaveMessage(`Asignación guardada localmente: ${errorMsg}`);
      }
    } finally {
      setIsSaving(false);
    }
=======
  const handleSaveAssignment = () => {
    if (!selectedArticle || selectedReviewerIds.length !== 3 || isSaving) return;

    setIsSaving(true);
    const previousIds = assignments[selectedArticle.id] ?? [];
    const nextIds = [...selectedReviewerIds];

    setAssignments((current) => ({
      ...current,
      [selectedArticle.id]: nextIds,
    }));
    setWorkloadAdjustments((current) => {
      const next = { ...current };
      previousIds
        .filter((id) => !nextIds.includes(id))
        .forEach((id) => {
          next[id] = (next[id] ?? 0) - 1;
        });
      nextIds
        .filter((id) => !previousIds.includes(id))
        .forEach((id) => {
          next[id] = (next[id] ?? 0) + 1;
        });
      return next;
    });
    setSaveMessage(
      'Asignación guardada en esta sesión de demostración. El backend de esta rama aún no expone el endpoint de asignación.'
    );
    setIsSaving(false);
>>>>>>> c4eba67dae7dfa8dbfa02fcd10e087eca0204beb
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

      {isFallbackData && (
        <div
          className="flex min-w-0 items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
          role="status"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            Modo de demostración: los artículos y miembros del comité son datos locales;
            la asignación solo se conserva en el estado de esta sesión.
          </p>
        </div>
      )}

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

              {conflictedMembers.length > 0 && (
                <div
                  className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
                  role="status"
                >
                  <p className="font-semibold">Conflictos de interés excluidos:</p>
                  <p className="mt-1 break-words">
                    {conflictedMembers.map((member) => member.full_name).join(', ')}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3">
                <span className="text-sm font-semibold text-slate-800">
                  Seleccionados: {selectedReviewerIds.length} / 3
                </span>
                <span className="text-[11px] text-slate-500">
                  {eligibleMembers.length} candidatos elegibles
                </span>
              </div>

              <div className="max-h-[28rem] min-w-0 space-y-2 overflow-y-auto">
                {eligibleMembers.map((member) => {
                  const isSelected = selectedReviewerIds.includes(member.id);
                  const hasAffinity = member.thematic_lines.includes(
                    selectedArticle.thematic_line
                  );
                  const workload =
                    member.assigned_article_count + (workloadAdjustments[member.id] ?? 0);
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
                        <span className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
                              hasAffinity
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {hasAffinity && <Award className="h-3 w-3" />}
                            {hasAffinity ? 'Afinidad alta' : 'Otra área'}
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

              {selectedReviewerIds.length !== 3 && (
                <p className="text-xs text-amber-800" role="status">
                  Se requieren exactamente 3 jurados distintos para guardar la asignación.
                </p>
              )}
              {saveMessage && (
                <p
                  className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
                  role="status"
                >
                  {saveMessage}
                </p>
              )}
              <button
                type="button"
                onClick={handleSaveAssignment}
                disabled={selectedReviewerIds.length !== 3 || isSaving}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSaving ? 'Guardando...' : 'Guardar asignación'}
              </button>
            </section>
          )}
        </div>
      )}
    </section>
  );
};
