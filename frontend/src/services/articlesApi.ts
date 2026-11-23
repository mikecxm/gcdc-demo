import { apiClient } from './api';
import type { Article, CommitteeMember } from '../types/article';

export const THEMATIC_LINES: string[] = [
  'Inteligencia Artificial',
  'Ingeniería de Software',
  'Sistemas Distribuidos',
  'Ciberseguridad',
  'Ciencia de Datos',
];

export const ARTICLE_STATUSES: { value: string; label: string }[] = [
  { value: 'POSTULADO', label: 'Postulado' },
  { value: 'EN_EVALUACION', label: 'En Evaluación' },
  { value: 'ACEPTADO', label: 'Aceptado' },
  { value: 'RECHAZADO', label: 'Rechazado' },
  { value: 'CON_AVAL', label: 'Con Aval' },
];

export const MOCK_ARTICLES: Article[] = [
  {
    id: 1,
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
    pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
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
    id: 2,
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
    status: 'EN_EVALUACION',
    is_enabled: true,
    submitted_at: '2026-10-12T09:15:00Z',
    pdf_url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf',
    coauthors: [],
  },
  {
    id: 3,
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
    pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
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
    status: 'CON_AVAL',
    is_enabled: true,
    submitted_at: '2026-09-15T11:20:00Z',
    pdf_url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf',
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
    pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
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
    status: 'CON_AVAL',
    is_enabled: true,
    submitted_at: '2026-10-05T08:50:00Z',
    pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
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
    pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    coauthors: [],
  },
];

export const MOCK_COMMITTEE_MEMBERS: CommitteeMember[] = [
  {
    id: 101,
    email: 'carlos.mendoza@correounivalle.edu.co',
    full_name: 'Dr. Carlos Mendoza',
    roles: ['COMITE'],
    thematic_lines: ['Inteligencia Artificial'],
    assigned_article_count: 2,
  },
  {
    id: 11,
    email: 'mateo.gomez@correounivalle.edu.co',
    full_name: 'Ing. Mateo Gómez',
    roles: ['COMITE'],
    thematic_lines: ['Sistemas Distribuidos'],
    assigned_article_count: 1,
  },
  {
    id: 12,
    email: 'sofia.rincon@unal.edu.co',
    full_name: 'Dra. Sofía Rincón',
    roles: ['COMITE'],
    thematic_lines: ['Inteligencia Artificial'],
    assigned_article_count: 3,
  },
  {
    id: 202,
    email: 'elena.valencia@correounivalle.edu.co',
    full_name: 'Dra. Elena Valencia',
    roles: ['COMITE'],
    thematic_lines: ['Inteligencia Artificial', 'Ciencia de Datos'],
    assigned_article_count: 2,
  },
  {
    id: 203,
    email: 'james.wilson@univalle.edu.co',
    full_name: 'James Wilson',
    roles: ['COMITE'],
    thematic_lines: ['Ciberseguridad'],
    assigned_article_count: 0,
  },
  {
    id: 204,
    email: 'ana.martinez@univalle.edu.co',
    full_name: 'Dra. Ana Martínez',
    roles: ['COMITE'],
    thematic_lines: ['Inteligencia Artificial'],
    assigned_article_count: 4,
  },
  {
    id: 205,
    email: 'david.ortiz@univalle.edu.co',
    full_name: 'Dr. David Ortiz',
    roles: ['COMITE'],
    thematic_lines: ['Ingeniería de Software'],
    assigned_article_count: 1,
  },
  {
    id: 206,
    email: 'lucia.vega@univalle.edu.co',
    full_name: 'MSc. Lucía Vega',
    roles: ['COMITE'],
    thematic_lines: ['Sistemas Distribuidos', 'Ciencia de Datos'],
    assigned_article_count: 5,
  },
];

export interface FetchArticlesResponse {
  data: Article[];
  isFallback: boolean;
  total: number;
}

/**
 * Obtiene la lista de artículos desde el backend (/articles/ o /api/articles/).
 * Si el endpoint aún no está disponible o falla, retorna automáticamente los datos mock de respaldo.
 */
export const getArticles = async (): Promise<FetchArticlesResponse> => {
  try {
    const response = await apiClient.get<Article[]>('/articles/');
    if (Array.isArray(response.data) && response.data.length > 0) {
      return {
        data: response.data.filter((art) => art.is_enabled),
        isFallback: false,
        total: response.data.length,
      };
    }
    // Si la API responde con un arreglo vacío, usamos el mock para permitir evaluar la interfaz
    return {
      data: MOCK_ARTICLES.filter((art) => art.is_enabled),
      isFallback: true,
      total: MOCK_ARTICLES.filter((art) => art.is_enabled).length,
    };
  } catch (err) {
    console.warn(
      '[Symposia Articles] El endpoint /articles/ aún no está disponible en el backend. Usando datos simulados (Mock Data):',
      err
    );
    return {
      data: MOCK_ARTICLES.filter((art) => art.is_enabled),
      isFallback: true,
      total: MOCK_ARTICLES.filter((art) => art.is_enabled).length,
    };
  }
};

export interface AssignReviewersPayload {
  article_id: number;
  reviewer_ids: number[];
}

export interface AssignReviewersResponse {
  article_id: number;
  article_title: string;
  article_status: string;
  message: string;
  assignments: Array<{
    id: number;
    reviewer_id: number;
    reviewer_email: string;
    reviewer_name: string;
    assigned_at: string;
  }>;
}

/**
 * Realiza la asignación de 3 jurados al artículo en el backend (HU-12 / GCDC-161).
 * Endpoint: POST /api/v1/reviews/assign-reviewers/
 */
export const assignReviewers = async (
  payload: AssignReviewersPayload
): Promise<AssignReviewersResponse> => {
  const response = await apiClient.post<AssignReviewersResponse>(
    '/reviews/assign-reviewers/',
    payload
  );
  return response.data;
};

/**
 * Consulta la lista de miembros del comité científico activos desde el backend (HU-12 / GCDC-161).
 */
export const getCommitteeMembers = async (): Promise<CommitteeMember[]> => {
  try {
    const response = await apiClient.get<CommitteeMember[]>('/reviews/committee-members/');
    if (Array.isArray(response.data) && response.data.length > 0) {
      return response.data;
    }
    return MOCK_COMMITTEE_MEMBERS.filter((m) => m.roles.includes('COMITE'));
  } catch {
    return MOCK_COMMITTEE_MEMBERS.filter((m) => m.roles.includes('COMITE'));
  }
};

/**
 * Consulta las sugerencias balanceadas de jurados para un artículo (HU-12 / GCDC-161).
 */
export const getReviewerSuggestions = async (
  articleId: number
): Promise<CommitteeMember[]> => {
  try {
    const response = await apiClient.get<CommitteeMember[]>(
      `/reviews/suggest-reviewers/?article_id=${articleId}`
    );
    if (Array.isArray(response.data) && response.data.length > 0) {
      return response.data;
    }
    return [];
  } catch {
    return [];
  }
};
