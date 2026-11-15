import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context';
import { getArticles, THEMATIC_LINES, ARTICLE_STATUSES } from '../services/articlesApi';
import type { Article } from '../types/article';
import { getStatusBadgeConfig } from '../types/article';
import { ArticleDetailModal } from '../components/articles/ArticleDetailModal';
import {
  Search,
  Filter,
  RotateCcw,
  BookOpen,
  Calendar,
  User,
  Users,
  Eye,
  Building2,
  Shield,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import type { UserRole } from '../services/api';

export const ArticleCatalogView: React.FC = () => {
  const { user, role, setDevRole } = useAuth();

  // Estados de datos
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFallbackData, setIsFallbackData] = useState<boolean>(false);

  // Estados de filtros
  const [selectedThematicLine, setSelectedThematicLine] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Estado del Modal de Detalle
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Cargar artículos desde el servicio
  const loadArticles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getArticles();
      setAllArticles(response.data);
      setIsFallbackData(response.isFallback);
    } catch (err) {
      console.error('Error al cargar artículos:', err);
      setError('No fue posible cargar el catálogo de artículos. Inténtalo nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getArticles()
      .then((response) => {
        if (isMounted) {
          setAllArticles(response.data);
          setIsFallbackData(response.isFallback);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error al cargar artículos:', err);
          setError('No fue posible cargar el catálogo de artículos. Inténtalo nuevamente.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * REGLA VISUAL DE PRIVACIDAD:
   * - AUTOR: Solo ve sus propios artículos activos (coincidencia por ID o email del autor responsable).
   * - COMITE o ADMIN: Ven todo el catálogo de artículos activos.
   */
  const scopedArticles = useMemo(() => {
    if (!user) return allArticles;

    if (role === 'AUTOR') {
      return allArticles.filter(
        (article) =>
          article.responsible_author.id === user.id ||
          article.responsible_author.email.toLowerCase() === user.email.toLowerCase()
      );
    }

    // COMITE y ADMIN ven todos los artículos activos
    return allArticles;
  }, [allArticles, role, user]);

  /**
   * FILTROS COMBINADOS EN TIEMPO REAL:
   * 1. Línea Temática
   * 2. Estado del artículo
   * 3. Búsqueda por texto (título, autor o resumen)
   */
  const filteredArticles = useMemo(() => {
    return scopedArticles.filter((article) => {
      // Filtro de Línea Temática
      const matchesThematicLine =
        selectedThematicLine === 'ALL' || article.thematic_line === selectedThematicLine;

      // Filtro de Estado
      const matchesStatus =
        selectedStatus === 'ALL' || article.status === selectedStatus;

      // Filtro de Búsqueda
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === '' ||
        article.title.toLowerCase().includes(query) ||
        article.abstract.toLowerCase().includes(query) ||
        article.responsible_author.full_name.toLowerCase().includes(query) ||
        article.responsible_author.affiliation.toLowerCase().includes(query) ||
        article.keywords.toLowerCase().includes(query);

      return matchesThematicLine && matchesStatus && matchesSearch;
    });
  }, [scopedArticles, selectedThematicLine, selectedStatus, searchQuery]);

  const handleClearFilters = () => {
    setSelectedThematicLine('ALL');
    setSelectedStatus('ALL');
    setSearchQuery('');
  };

  const handleOpenDetail = (article: Article) => {
    setSelectedArticle(article);
    setIsModalOpen(true);
  };

  const handleCloseDetail = () => {
    setIsModalOpen(false);
    setSelectedArticle(null);
  };

  const hasActiveFilters =
    selectedThematicLine !== 'ALL' || selectedStatus !== 'ALL' || searchQuery.trim() !== '';

  return (
    <div className="w-full space-y-6 text-left">
      {/* ========================================================
          1. HEADER Y BARRA DE ROL ACTIVO (FALLBACK / TESTING)
         ======================================================== */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase">
                CONFERENCIA SYMPOSIA 2026
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                GESTIÓN EDITORIAL
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
              <BookOpen className="w-7 h-7 text-indigo-600 flex-shrink-0" />
              <span>Catálogo de Artículos</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Explora, filtra y consulta los manuscritos postulados a la conferencia académica.
            </p>
          </div>

          {/* Switcher Rápido de Rol para Pruebas de Privacidad */}
          <div className="bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-2 text-slate-500 font-medium">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>Vista actual como:</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {(['AUTOR', 'COMITE', 'ADMIN'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDevRole(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    role === r
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {r === 'AUTOR' ? 'Autor' : r === 'COMITE' ? 'Comité' : 'Admin'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Banner Informativo de la Regla de Privacidad */}
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
            role === 'AUTOR'
              ? 'bg-amber-50/70 border-amber-200/80 text-amber-900'
              : 'bg-indigo-50/70 border-indigo-200/80 text-indigo-900'
          }`}
        >
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-0.5">
            <span className="font-semibold block">
              {role === 'AUTOR'
                ? 'Modo Autor Activado (Privacidad Estricta)'
                : `Modo ${role === 'COMITE' ? 'Comité Científico' : 'Administrador'} Activado`}
            </span>
            <p className="text-[11px] leading-relaxed opacity-90">
              {role === 'AUTOR'
                ? `Como autor registrado (${user?.full_name || 'Dr. Carlos Mendoza'}), solo tienes acceso a tus propios artículos postulados (${scopedArticles.length} en total).`
                : `Tienes permisos para examinar todos los artículos activos postulados por los autores en la conferencia (${scopedArticles.length} en total).`}
            </p>
          </div>
        </div>

        {/* Aviso de Modo Demo si se usan datos simulados */}
        {isFallbackData && (
          <div className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>
                <strong>Modo Demostración:</strong> El endpoint <code className="font-mono text-indigo-600">GET /articles/</code> aún no está expuesto en backend; usando datos de prueba activos.
              </span>
            </div>
            <button
              onClick={loadArticles}
              className="text-indigo-600 hover:underline font-semibold flex-shrink-0"
            >
              Reintentar API
            </button>
          </div>
        )}
      </div>

      {/* ========================================================
          2. SECCIÓN DE FILTROS COMBINADOS EN TIEMPO REAL
         ======================================================== */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Barra de Búsqueda Instantánea */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, autor, abstract o palabras clave..."
              className="w-full h-10 pl-10 pr-4 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Select: Línea Temática */}
          <div className="w-full lg:w-60">
            <label htmlFor="filter-thematic-line" className="sr-only">
              Línea Temática
            </label>
            <div className="relative">
              <Layers className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="filter-thematic-line"
                value={selectedThematicLine}
                onChange={(e) => setSelectedThematicLine(e.target.value)}
                className="w-full h-10 pl-9 pr-8 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all appearance-none cursor-pointer"
              >
                <option value="ALL">Todas las líneas temáticas</option>
                {THEMATIC_LINES.map((line) => (
                  <option key={line} value={line}>
                    {line}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                ▼
              </div>
            </div>
          </div>

          {/* Select: Estado del Artículo */}
          <div className="w-full lg:w-52">
            <label htmlFor="filter-status" className="sr-only">
              Estado del Artículo
            </label>
            <div className="relative">
              <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="filter-status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full h-10 pl-9 pr-8 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all appearance-none cursor-pointer"
              >
                <option value="ALL">Todos los estados</option>
                {ARTICLE_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                ▼
              </div>
            </div>
          </div>

          {/* Botón: Limpiar Filtros */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="h-10 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors self-start lg:self-auto flex-shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>

        {/* Barra de Conteo y Resumen de Resultados */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div>
            Mostrando{' '}
            <span className="font-bold text-slate-900">{filteredArticles.length}</span>{' '}
            de{' '}
            <span className="font-bold text-slate-900">{scopedArticles.length}</span>{' '}
            artículos disponibles
          </div>

          {hasActiveFilters && (
            <span className="text-[11px] text-indigo-600 font-medium">
              Filtros activos aplicados en tiempo real
            </span>
          )}
        </div>
      </div>

      {/* ========================================================
          3. CATÁLOGO / GRILLA DE ARTÍCULOS
         ======================================================== */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="p-5 rounded-2xl bg-white border border-slate-200 animate-pulse space-y-4 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="w-24 h-5 bg-slate-200 rounded-md" />
                <div className="w-20 h-5 bg-slate-200 rounded-md" />
              </div>
              <div className="w-3/4 h-6 bg-slate-200 rounded-md" />
              <div className="w-full h-12 bg-slate-200 rounded-md" />
              <div className="w-1/2 h-4 bg-slate-200 rounded-md" />
              <div className="w-full h-9 bg-slate-200 rounded-xl mt-4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-white border border-rose-200 text-center space-y-3">
          <p className="text-sm font-semibold text-rose-700">{error}</p>
          <button
            type="button"
            onClick={loadArticles}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            No se encontraron artículos
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'No hay artículos que coincidan con la combinación de filtros seleccionada. Prueba modificando los parámetros.'
              : role === 'AUTOR'
              ? 'No tienes artículos postulados activos actualmente con esta cuenta.'
              : 'No hay artículos registrados en el catálogo en este momento.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer filtros</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredArticles.map((article) => {
            const statusConfig = getStatusBadgeConfig(article.status);
            const StatusIcon = statusConfig.icon;
            const formattedDate = new Date(article.submitted_at).toLocaleDateString('es-CO', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={article.id}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Cabecera de la Tarjeta */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 truncate max-w-[190px]">
                      {article.thematic_line}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border} flex-shrink-0`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {statusConfig.label}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug tracking-tight group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {article.title}
                  </h3>

                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                    {article.abstract}
                  </p>
                </div>

                {/* Pie de la Tarjeta con Metadatos y Botón de Acción */}
                <div className="px-5 pb-5 pt-3 border-t border-slate-100 bg-slate-50/50 space-y-3">
                  {/* Autor y fecha */}
                  <div className="space-y-1.5 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="font-medium text-slate-800 truncate">
                        {article.responsible_author.full_name}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate pr-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{article.responsible_author.affiliation}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 flex-shrink-0">
                        <Calendar className="w-3 h-3" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>

                    {article.coauthors.length > 0 && (
                      <div className="flex items-center gap-1.5 text-slate-400 text-[10px] pt-0.5">
                        <Users className="w-3 h-3" />
                        <span>{article.coauthors.length} coautor(es) adjunto(s)</span>
                      </div>
                    )}
                  </div>

                  {/* Botón Primario: Abrir Modal de Detalle */}
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(article)}
                    className="w-full py-2 px-3 rounded-xl bg-white hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200 hover:border-transparent text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver detalle y manuscrito</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================
          4. MODAL DE DETALLE Y VISOR PDF EMBEBIDO
         ======================================================== */}
      <ArticleDetailModal
        article={selectedArticle}
        isOpen={isModalOpen}
        onClose={handleCloseDetail}
      />
    </div>
  );
};
