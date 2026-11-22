import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  Upload,
} from 'lucide-react';
import type { Article, ArticleVersion } from '../../types/article';
import {
  getArticleApiErrorMessage,
  getArticlePdf,
  getArticleVersions,
  uploadArticleVersion,
} from '../../services/articlesApi';

const MAX_PDF_SIZE = 10 * 1024 * 1024;
const MOCK_ARTICLE_IDS = new Set([101, 102, 103]);
const MOCK_DEADLINE = '2027-12-31';

interface PdfVersionManagerProps {
  article: Article;
  token: string | null;
  currentPdfUrl: string;
  localVersions: ArticleVersion[];
  onCurrentPdfUrlChange: (url: string) => void;
  onLocalVersionsChange: (versions: ArticleVersion[]) => void;
}

const getApiError = (error: unknown): string => getArticleApiErrorMessage(error);

const isPastDeadline = (deadline: string): boolean => {
  const deadlineDate = deadline.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineDate)) return true;
  const todayParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => todayParts.find((value) => value.type === type)?.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  return today > deadlineDate;
};

const getUrlFileName = (url: string): string | undefined =>
  decodeURIComponent(url.split('/').pop()?.split(/[?#]/)[0] ?? '') || undefined;

const getFileName = (version: ArticleVersion, articleId: number): string => {
  if (version.file_name) return version.file_name;
  return (
    (version.pdf_url && getUrlFileName(version.pdf_url)) ??
    `article-${articleId}-v${version.version_number}.pdf`
  );
};

export const PdfVersionManager: React.FC<PdfVersionManagerProps> = ({
  article,
  token,
  currentPdfUrl,
  localVersions,
  onCurrentPdfUrlChange,
  onLocalVersionsChange,
}) => {
  const [apiVersions, setApiVersions] = useState<ArticleVersion[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fileActionError, setFileActionError] = useState<string | null>(null);
  const [simulateExpired, setSimulateExpired] = useState(false);
  const createdObjectUrls = useRef(new Set<string>());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMockArticle = MOCK_ARTICLE_IDS.has(article.id);
  const deadline = article.submission_deadline ?? (isMockArticle ? MOCK_DEADLINE : undefined);
  const deadlineExpired = deadline ? isPastDeadline(deadline) : false;
  const articleAcceptsPdf = article.is_enabled && article.status === 'POSTULADO';
  const isUploadBlocked =
    !deadline || deadlineExpired || simulateExpired || !articleAcceptsPdf;

  useEffect(() => {
    const objectUrls = createdObjectUrls.current;
    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, [article.id]);

  useEffect(() => {
    let isCurrent = true;
    setIsLoadingHistory(true);
    setApiVersions([]);
    setHistoryError(null);
    getArticleVersions(article.id, token ?? undefined)
      .then((versions) => {
        if (isCurrent) setApiVersions(versions);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        if (isAxiosError(error) && error.response?.status === 404 && isMockArticle) {
          setApiVersions([]);
          return;
        }
        setHistoryError(getApiError(error));
      })
      .finally(() => {
        if (isCurrent) setIsLoadingHistory(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [article.id, isMockArticle, token]);

  const versions = useMemo(() => {
    const merged = new Map<number, ArticleVersion>();
    apiVersions.forEach((version) => merged.set(version.version_number, version));
    localVersions.forEach((version) => merged.set(version.version_number, version));

    if (merged.size === 0 && currentPdfUrl) {
      merged.set(1, {
        id: -article.id,
        version_number: 1,
        stage: 'INICIAL',
        uploaded_at: article.submitted_at,
        pdf_url: currentPdfUrl,
      });
    } else if (merged.size > 0 && currentPdfUrl) {
      const latestVersion = Math.max(...merged.keys());
      const latest = merged.get(latestVersion);
      if (latest && !latest.pdf_url) {
        merged.set(latestVersion, { ...latest, pdf_url: currentPdfUrl });
      }
    }

    return [...merged.values()].sort((first, second) => second.version_number - first.version_number);
  }, [apiVersions, article.id, article.submitted_at, currentPdfUrl, localVersions]);

  const handleFile = (file?: File) => {
    setUploadError(null);
    setSuccessMessage(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setSelectedFile(null);
      setUploadError('Selecciona un archivo con extensión .pdf.');
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      setSelectedFile(null);
      setUploadError('El PDF no puede superar 10 MB.');
      return;
    }
    setSelectedFile(file);
  };

  const getVersionPdfUrl = async (version: ArticleVersion): Promise<string> => {
    if (version.pdf_url) return version.pdf_url;
    const pdf = await getArticlePdf(article.id, undefined, version.version_number);
    const url = URL.createObjectURL(pdf);
    createdObjectUrls.current.add(url);
    return url;
  };

  const handleOpenVersion = async (version: ArticleVersion) => {
    setFileActionError(null);
    const previewWindow = window.open('about:blank', '_blank');
    if (!previewWindow) {
      setFileActionError('Permite las ventanas emergentes para abrir el PDF.');
      return;
    }
    previewWindow.opener = null;
    try {
      previewWindow.location.href = await getVersionPdfUrl(version);
    } catch (error) {
      previewWindow.close();
      setFileActionError(getApiError(error));
    }
  };

  const handleDownloadVersion = async (version: ArticleVersion) => {
    setFileActionError(null);
    try {
      const url = await getVersionPdfUrl(version);
      const link = document.createElement('a');
      link.href = url;
      link.download = getFileName(version, article.id);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      setFileActionError(getApiError(error));
    }
  };

  const handleReplace = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile || isUploadBlocked || isUploading) return;

    setIsUploading(true);
    setUploadError(null);
    setSuccessMessage(null);
    try {
      let responseVersion: ArticleVersion | undefined;
      const formData = new FormData();
      formData.append('pdf', selectedFile);
      try {
        const response = await uploadArticleVersion(
          article.id,
          formData,
          token ?? undefined
        );
        if (response.status !== 201) {
          throw new Error(`El servidor respondió con estado ${response.status}.`);
        }
        responseVersion = response.data;
      } catch (error) {
        const isMockNotFound =
          isAxiosError(error) && error.response?.status === 404 && isMockArticle;
        if (!isMockNotFound) throw error;
      }

      const latestNumber = versions.reduce(
        (latest, version) => Math.max(latest, version.version_number),
        0
      );
      const newVersionNumber = responseVersion?.version_number ?? latestNumber + 1;
      const now = new Date().toISOString();
      const nextVersions = [...localVersions];
      const priorVersionNumber = newVersionNumber - 1;

      if (currentPdfUrl && priorVersionNumber > 0) {
        const priorIndex = nextVersions.findIndex(
          (version) => version.version_number === priorVersionNumber
        );
        const archivedPrior: ArticleVersion = {
          id: nextVersions[priorIndex]?.id ?? -Date.now(),
          version_number: priorVersionNumber,
          stage: nextVersions[priorIndex]?.stage ?? 'INICIAL',
          uploaded_at: nextVersions[priorIndex]?.uploaded_at ?? now,
          file_name:
            nextVersions[priorIndex]?.file_name ??
            getUrlFileName(currentPdfUrl) ??
            `Manuscrito-v${priorVersionNumber}.pdf`,
          pdf_url: currentPdfUrl,
        };
        if (priorIndex >= 0) nextVersions[priorIndex] = archivedPrior;
        else nextVersions.push(archivedPrior);
      }

      const newPdfUrl = URL.createObjectURL(selectedFile);
      createdObjectUrls.current.add(newPdfUrl);
      nextVersions.push({
        id: responseVersion?.id ?? -Date.now(),
        version_number: newVersionNumber,
        stage: responseVersion?.stage ?? 'INICIAL',
        uploaded_at: responseVersion?.uploaded_at ?? now,
        file_name: selectedFile.name,
        pdf_url: newPdfUrl,
      });
      onLocalVersionsChange(nextVersions);
      onCurrentPdfUrlChange(newPdfUrl);
      setSelectedFile(null);
      setSuccessMessage(`El manuscrito se reemplazó correctamente (versión ${newVersionNumber}).`);

      if (responseVersion) {
        const [historyResult, pdfResult] = await Promise.allSettled([
          getArticleVersions(article.id, token ?? undefined),
          getArticlePdf(article.id, undefined, newVersionNumber),
        ]);
        if (historyResult.status === 'fulfilled') {
          setApiVersions(historyResult.value);
          setHistoryError(null);
        } else {
          setHistoryError(
            `La versión se subió, pero no se pudo actualizar el historial: ${getApiError(historyResult.reason)}`
          );
        }
        if (pdfResult.status === 'fulfilled') {
          const refreshedPdfUrl = URL.createObjectURL(pdfResult.value);
          createdObjectUrls.current.add(refreshedPdfUrl);
          URL.revokeObjectURL(newPdfUrl);
          createdObjectUrls.current.delete(newPdfUrl);
          onCurrentPdfUrlChange(refreshedPdfUrl);
          onLocalVersionsChange(
            nextVersions.map((version) =>
              version.version_number === newVersionNumber
                ? { ...version, pdf_url: refreshedPdfUrl }
                : version
            )
          );
        } else {
          setUploadError(
            `La versión se subió, pero no se pudo actualizar el visor: ${getApiError(pdfResult.reason)}`
          );
        }
      }
    } catch (error) {
      setUploadError(getApiError(error));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="min-w-0 space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 sm:p-4">
      <div className="flex min-w-0 items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-800">Reemplazo e historial de versiones</h3>
          {deadline ? (
            <p className="mt-1 break-words text-xs text-slate-600">
              Fecha límite para reemplazar: {new Date(`${deadline.slice(0, 10)}T00:00:00`).toLocaleDateString('es-CO')}
            </p>
          ) : (
            <p className="mt-1 text-xs text-amber-800">
              La fecha límite no está disponible. No se habilitará la carga hasta conocer el plazo.
            </p>
          )}
        </div>
      </div>

      {deadlineExpired || simulateExpired ? (
        <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>El plazo para reemplazar el manuscrito ya venció. La carga de una nueva versión está bloqueada.</p>
        </div>
      ) : !articleAcceptsPdf ? (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>El artículo no está activo o ya no está en estado POSTULADO; no admite cambios de PDF.</p>
        </div>
      ) : !deadline ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
          No es posible confirmar si el plazo está vigente; la carga permanece bloqueada.
        </div>
      ) : (
        <form
          onSubmit={handleReplace}
          className="min-w-0 space-y-3 rounded-lg border border-slate-200 bg-white p-3"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!isUploading) handleFile(event.dataTransfer.files[0]);
          }}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-describedby={`pdf-replacement-hint-${article.id}`}
            className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center text-xs transition-colors ${
              isUploadBlocked || isUploading
                ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                : 'border-indigo-300 text-slate-600 hover:bg-indigo-50'
            }`}
            disabled={isUploadBlocked || isUploading}
          >
            <Upload className="h-5 w-5 text-indigo-500" />
            <span className="break-all font-medium">
              {selectedFile?.name ?? 'Selecciona o arrastra aquí el nuevo PDF'}
            </span>
            <span id={`pdf-replacement-hint-${article.id}`}>Formato .pdf · máximo 10 MB</span>
          </button>
          <input
            ref={fileInputRef}
            id={`pdf-replacement-${article.id}`}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            disabled={isUploadBlocked || isUploading}
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <button
            type="submit"
            disabled={!selectedFile || isUploadBlocked || isUploading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
          >
            {isUploading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Subiendo...
              </>
            ) : (
              'Confirmar reemplazo'
            )}
          </button>
        </form>
      )}

      {import.meta.env.DEV && (
        <label className="flex w-fit items-center gap-2 text-[11px] text-slate-500">
          <input
            type="checkbox"
            checked={simulateExpired}
            onChange={(event) => setSimulateExpired(event.target.checked)}
            className="rounded border-slate-300 text-indigo-600"
          />
          Simular plazo vencido
        </label>
      )}

      {uploadError && (
        <p className="break-words rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
          {uploadError}
        </p>
      )}
      {successMessage && (
        <p className="flex gap-2 break-words rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {successMessage}
        </p>
      )}
      {fileActionError && (
        <p className="break-words rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
          {fileActionError}
        </p>
      )}

      <div className="min-w-0 space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Versiones anteriores</h4>
        {isLoadingHistory && (
          <p className="text-xs text-slate-500">Cargando historial...</p>
        )}
        {historyError && (
          <p className="break-words rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" role="status">
            No fue posible consultar el historial del servidor: {historyError}
          </p>
        )}
        {!isLoadingHistory && versions.length === 0 && (
          <p className="rounded-lg bg-white p-3 text-xs text-slate-500">Aún no hay versiones registradas.</p>
        )}
        {versions.map((version) => {
          const fileName = getFileName(version, article.id);
          return (
            <div
              key={`${version.version_number}-${version.id}`}
              className="flex min-w-0 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  Versión {version.version_number}
                </p>
                <p className="break-all text-xs text-slate-600">{fileName}</p>
                <p className="text-[11px] text-slate-400">
                  {Number.isNaN(new Date(version.uploaded_at).getTime())
                    ? 'Fecha no disponible'
                    : new Date(version.uploaded_at).toLocaleString('es-CO')}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => void handleOpenVersion(version)}
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir PDF
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadVersion(version)}
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  Descargar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
