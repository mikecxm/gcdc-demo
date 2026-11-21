import axios from 'axios';
import { apiClient } from './api';
import type { Article, ArticleStatus, ArticleVersion } from '../types/article';

export interface ThematicLine {
  id: number;
  name: string;
}

export const ARTICLE_STATUSES: { value: ArticleStatus; label: string }[] = [
  { value: 'POSTULADO', label: 'Postulado' },
  { value: 'EN_REVISION', label: 'En revisión' },
  { value: 'ACEPTADO', label: 'Aceptado' },
  { value: 'RECHAZADO', label: 'Rechazado' },
  { value: 'AVAL_PRESENTACION', label: 'Aval para presentación' },
  { value: 'AVAL_PUBLICACION', label: 'Aval para publicación' },
];

export const MOCK_ARTICLES: Article[] = [
  {
    id: 101,
    title: 'Optimización de Modelos Fundacionales para Detección Temprana de Plagas en Cultivos de Caña',
    abstract:
      'Este trabajo presenta un enfoque novedoso basado en visión por computadora y modelos fundacionales ligeros adaptados para la identificación temprana de anomalías en cultivos agrícolas del Valle del Cauca. Se evalúa el desempeño en inferencia en el borde (edge computing) con una precisión de F1-Score superior al 94.2% frente a perturbaciones climáticas extremas.',
    keywords: 'Visión Artificial, Edge Computing, Agricultura de Precisión, Modelos Fundacionales',
    thematic_line: 'Inteligencia Artificial',
    responsible_author: {
      id: 101,
      full_name: 'Dr. Carlos Mendoza',
      email: 'carlos.mendoza@correounivalle.edu.co',
      affiliation: 'Universidad del Valle - Escuela de Ing. de Sistemas',
    },
    status: 'POSTULADO',
    is_enabled: true,
    submitted_at: '2026-10-18T14:32:00Z',
    pdf_url: '/manuscript-sample.pdf',
    coauthors: [
      {
        id: 11,
        full_name: 'Ing. Mateo Gómez',
        email: 'mateo.gomez@correounivalle.edu.co',
        affiliation: 'Universidad del Valle',
        is_corresponding_author: false,
      },
      {
        id: 12,
        full_name: 'Dra. Sofía Rincón',
        email: 'sofia.rincon@unal.edu.co',
        affiliation: 'Universidad Nacional de Colombia',
        is_corresponding_author: true,
      },
    ],
  },
  {
    id: 102,
    title: 'Arquitectura de Microservicios Resilientes con Consenso Raft para Sistemas de Salud',
    abstract:
      'Analizamos la implementación de un clúster distribuido tolerante a particiones de red para la historia clínica interoperable en el suroccidente colombiano. Se demuestra cómo mitigar estados inconsistentes y latencias críticas bajo condiciones de alta concurrencia y conectividad intermitente.',
    keywords: 'Sistemas Distribuidos, Raft, Microservicios, Salud Digital',
    thematic_line: 'Sistemas Distribuidos',
    responsible_author: {
      id: 101,
      full_name: 'Dr. Carlos Mendoza',
      email: 'carlos.mendoza@correounivalle.edu.co',
      affiliation: 'Universidad del Valle - Escuela de Ing. de Sistemas',
    },
    status: 'EN_REVISION',
    is_enabled: true,
    submitted_at: '2026-10-12T09:15:00Z',
    pdf_url: '/manuscript-sample.pdf',
    coauthors: [],
  },
  {
    id: 103,
    title: 'Framework para la Verificación Formal de Smart Contracts en Redes Blockchain de Segunda Capa',
    abstract:
      'Proponemos una metodología de análisis estático y verificación formal aplicada a contratos inteligentes financieros. Mediante demostración automática de teoremas reducimos en un 87% las vulnerabilidades por reentrancia, desbordamiento aritmético y fallos de aserción en protocolos DeFi.',
    keywords: 'Ciberseguridad, Blockchain, Verificación Formal, Smart Contracts',
    thematic_line: 'Ciberseguridad',
    responsible_author: {
      id: 103,
      full_name: 'Dr. Andrés Felipe Caicedo',
      email: 'andres.caicedo@correounivalle.edu.co',
      affiliation: 'Universidad del Valle - Departamento de Ciencias de la Computación',
    },
    status: 'ACEPTADO',
    is_enabled: true,
    submitted_at: '2026-09-28T16:45:00Z',
    pdf_url: '/manuscript-sample.pdf',
    coauthors: [
      {
        id: 13,
        full_name: 'MSc. Laura Restrepo',
        email: 'laura.restrepo@icesi.edu.co',
        affiliation: 'Universidad Icesi',
        is_corresponding_author: false,
      },
    ],
  },
  {
    id: 4,
    title: 'Análisis Geoespacial y Predictivo de la Calidad del Aire en Zonas Urbanas de Alta Densidad',
    abstract:
      'Se presentan técnicas avanzadas de Deep Learning y grafos espacio-temporales para el pronóstico horario de material particulado PM2.5 utilizando datos de sensores IoT de bajo costo instalados en el área metropolitana de Cali y Yumbo.',
    keywords: 'Ciencia de Datos, IoT, Sensores Ambientales, Grafos Temporales',
    thematic_line: 'Ciencia de Datos',
    responsible_author: {
      id: 104,
      full_name: 'Dra. María Jimena Ortiz',
      email: 'maria.ortiz@javerianacali.edu.co',
      affiliation: 'Pontificia Universidad Javeriana Cali',
    },
    status: 'AVAL_PRESENTACION',
    is_enabled: true,
    submitted_at: '2026-09-15T11:20:00Z',
    pdf_url: '/manuscript-sample.pdf',
    coauthors: [
      {
        id: 14,
        full_name: 'Dr. Fernando Duque',
        email: 'fernando.duque@correounivalle.edu.co',
        affiliation: 'Universidad del Valle',
        is_corresponding_author: false,
      },
      {
        id: 15,
        full_name: 'Ing. Camila Pardo',
        email: 'camila.pardo@javerianacali.edu.co',
        affiliation: 'Pontificia Universidad Javeriana Cali',
        is_corresponding_author: true,
      },
    ],
  },
  {
    id: 5,
    title: 'Patrones Arquitectónicos Ágiles para Plataformas de Aprendizaje Adaptativo Universitario',
    abstract:
      'Estudio empírico longitudinal sobre la evolución de arquitecturas monolíticas hacia microservicios dirigidos por eventos en plataformas educativas universitarias, soportando picos de 35.000 estudiantes simultáneos durante evaluaciones sincrónicas.',
    keywords: 'Ingeniería de Software, Event-Driven, Arquitectura Limpia, Educación Virtual',
    thematic_line: 'Ingeniería de Software',
    responsible_author: {
      id: 105,
      full_name: 'Prof. Guillermo Vargas',
      email: 'guillermo.vargas@correounivalle.edu.co',
      affiliation: 'Universidad del Valle - Escuela de Ing. de Sistemas',
    },
    status: 'RECHAZADO',
    is_enabled: true,
    submitted_at: '2026-08-30T17:10:00Z',
    pdf_url: '/manuscript-sample.pdf',
    coauthors: [
      {
        id: 16,
        full_name: 'Ing. Sandra López',
        email: 'sandra.lopez@correounivalle.edu.co',
        affiliation: 'Universidad del Valle',
        is_corresponding_author: false,
      },
    ],
  },
  {
    id: 6,
    title: 'Técnicas de Compresión y Cuantización Cuántica de Modelos NLP para Dispositivos Móviles',
    abstract:
      'Investigación preliminar sobre algoritmos de poda neuronal estructurada y cuantización híbrida para modelos transformadores de procesamiento del lenguaje natural orientados a dialectos y modismos del Pacífico colombiano.',
    keywords: 'Inteligencia Artificial, NLP, Cuantización, Modelos Ligeros',
    thematic_line: 'Inteligencia Artificial',
    responsible_author: {
      id: 101,
      full_name: 'Dr. Carlos Mendoza',
      email: 'carlos.mendoza@correounivalle.edu.co',
      affiliation: 'Universidad del Valle - Escuela de Ing. de Sistemas',
    },
    status: 'AVAL_PUBLICACION',
    is_enabled: true,
    submitted_at: '2026-10-05T08:50:00Z',
    pdf_url: '/manuscript-sample.pdf',
    coauthors: [
      {
        id: 17,
        full_name: 'Dra. Beatriz Morales',
        email: 'beatriz.morales@correounivalle.edu.co',
        affiliation: 'Universidad del Valle',
        is_corresponding_author: false,
      },
    ],
  },
  {
    id: 7,
    title: 'Artículo Deshabilitado por Auditoría (No visible en catálogo activo)',
    abstract: 'Este artículo fue deshabilitado por el administrador y no debe ser listado en los artículos activos.',
    keywords: 'Auditoría, Deshabilitado',
    thematic_line: 'Ciberseguridad',
    responsible_author: {
      id: 101,
      full_name: 'Dr. Carlos Mendoza',
      email: 'carlos.mendoza@correounivalle.edu.co',
      affiliation: 'Universidad del Valle',
    },
    status: 'POSTULADO',
    is_enabled: false, // Inactivo: debe ser filtrado
    submitted_at: '2026-07-20T10:00:00Z',
    pdf_url: '/manuscript-sample.pdf',
    coauthors: [],
  },
];

export interface FetchArticlesResponse {
  data: Article[];
  total: number;
}

export interface ArticleListFilters {
  thematic_line?: string;
  status?: ArticleStatus;
  search?: string;
}

export const getArticleApiErrorMessage = (error: unknown): string => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  }

  if (!error.response) {
    return 'No fue posible conectarse con el servidor. Verifica que el backend esté en ejecución.';
  }

  const data: unknown = error.response.data;
  let message: string | undefined;

  if (typeof data === 'string') {
    message = data.trim() || undefined;
  } else if (typeof data === 'object' && data !== null) {
    const payload = data as Record<string, unknown>;
    const value = payload.detail ?? payload.non_field_errors ?? Object.values(payload)[0];
    if (typeof value === 'string') {
      message = value;
    } else if (Array.isArray(value)) {
      message = value.filter((item): item is string => typeof item === 'string').join(', ');
    }
  }

  if (message) return message;
  if (error.response.status === 401) return 'Inicia sesión con una cuenta válida para consultar los artículos.';
  if (error.response.status === 403) return 'No tienes permiso para consultar estos artículos.';
  if (error.response.status === 404) return 'El recurso solicitado no existe en el servidor.';
  return `El servidor respondió con el código ${error.response.status}.`;
};

export const getArticleVersions = async (
  articleId: number,
  token?: string
): Promise<ArticleVersion[]> => {
  const response = await apiClient.get<ArticleVersion[]>(
    `/articles/${articleId}/versions/`,
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
  );
  return response.data;
};

export const getThematicLines = async (
  signal?: AbortSignal
): Promise<ThematicLine[]> => {
  const response = await apiClient.get<ThematicLine[]>(
    '/conferences/thematic-lines/',
    { signal }
  );

  if (
    !Array.isArray(response.data) ||
    !response.data.every(
      (line) =>
        typeof line.id === 'number' &&
        typeof line.name === 'string'
    )
  ) {
    throw new Error('El servidor devolvió un formato de líneas temáticas no válido.');
  }

  return response.data;
};

export const replaceArticlePdf = async (articleId: number, pdf: File, token?: string) => {
  const formData = new FormData();
  formData.append('pdf', pdf);
  return apiClient.post<ArticleVersion>(
    `/articles/${articleId}/versions/`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );
};

/** Obtiene artículos activos desde la API y aplica los filtros combinados del catálogo. */
export const getArticles = async (
  filters: ArticleListFilters = {},
  signal?: AbortSignal
): Promise<FetchArticlesResponse> => {
  const params = {
    ...(filters.thematic_line ? { thematic_line: filters.thematic_line } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search ? { search: filters.search } : {}),
  };
  const response = await apiClient.get<Article[]>('/articles/', { params, signal });

  if (!Array.isArray(response.data)) {
    throw new Error('El servidor devolvió un formato de listado de artículos no válido.');
  }

  return { data: response.data, total: response.data.length };
};

/**
 * Obtiene el detalle de un artículo específico por su ID desde el backend (/articles/{id}/).
 */
export const getArticleById = async (id: number, signal?: AbortSignal): Promise<Article> => {
  const response = await apiClient.get<Article>(`/articles/${id}/`, { signal });
  return response.data;
};

export interface DisableArticleResponse {
  id: number;
  status: ArticleStatus;
  is_enabled: boolean;
  disabled_reason: string;
  disabled_at: string;
}

export const disableArticle = async (
  articleId: number,
  reason: string
): Promise<DisableArticleResponse> => {
  const response = await apiClient.post<DisableArticleResponse>(
    `/articles/${articleId}/disable/`,
    { reason }
  );
  return response.data;
};
