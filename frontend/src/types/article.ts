import type { LucideIcon } from 'lucide-react';
import { Clock, AlertCircle, CheckCircle2, XCircle, Award, FileText } from 'lucide-react';

export type ArticleStatus =
  | 'POSTULADO'
  | 'EN_EVALUACION'
  | 'ACEPTADO'
  | 'RECHAZADO'
  | 'CON_AVAL';

export interface CoAuthor {
  id: number;
  full_name: string;
  email: string;
  affiliation: string;
  is_corresponding_author?: boolean;
}

export interface ResponsibleAuthor {
  id: number;
  full_name: string;
  email: string;
  affiliation: string;
}

export interface Article {
  id: number;
  title: string;
  abstract: string;
  keywords: string;
  thematic_line: string;
  responsible_author: ResponsibleAuthor;
  status: ArticleStatus;
  is_enabled: boolean;
  submitted_at: string;
  pdf_url: string;
  coauthors: CoAuthor[];
}

export interface ArticleFilters {
  thematicLine: string;
  status: string;
  searchQuery: string;
}

export interface StatusBadgeConfig {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: LucideIcon;
}

export const getStatusBadgeConfig = (status: ArticleStatus): StatusBadgeConfig => {
  switch (status) {
    case 'POSTULADO':
      return {
        label: 'Postulado',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        icon: Clock,
      };
    case 'EN_EVALUACION':
      return {
        label: 'En Evaluación',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        icon: AlertCircle,
      };
    case 'ACEPTADO':
      return {
        label: 'Aceptado',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: CheckCircle2,
      };
    case 'RECHAZADO':
      return {
        label: 'Rechazado',
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        icon: XCircle,
      };
    case 'CON_AVAL':
      return {
        label: 'Con Aval',
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200',
        icon: Award,
      };
    default:
      return {
        label: status,
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-200',
        icon: FileText,
      };
  }
};
