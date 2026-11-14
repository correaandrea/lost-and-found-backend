import { BadRequestException } from '@nestjs/common';

/** Parámetros de consulta tal como llegan en la URL (todos son cadenas). */
export interface RawItemQuery {
  search?: string;
  location?: string;
  category?: string;
  city?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
}

export type CanonicalStatus = 'lost' | 'found';

/** Filtros validados y normalizados que consume el servicio. */
export interface ItemFilters {
  search?: string;
  location?: string;
  categories: string[];
  cities: string[];
  statuses: CanonicalStatus[];
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/** El campo `status` se guardó históricamente con valores heterogéneos. */
export const STATUS_VARIANTS: Record<CanonicalStatus, string[]> = {
  found: ['ENCONTRADO', 'encontrado', 'found', 'FOUND', 'Encontrado'],
  lost: ['PERDIDO', 'perdido', 'lost', 'LOST', 'Perdido'],
};

export function normalizeStatus(value: string): CanonicalStatus | null {
  const v = value.trim().toLowerCase();
  if (v === 'found' || v === 'encontrado') return 'found';
  if (v === 'lost' || v === 'perdido') return 'lost';
  return null;
}

export function oppositeStatusVariants(status: string): string[] {
  const canonical = normalizeStatus(status);
  if (canonical === 'found') return STATUS_VARIANTS.lost;
  if (canonical === 'lost') return STATUS_VARIANTS.found;
  return [];
}

function parseList(value?: string): string[] {
  if (!value) return [];
  return value
    .split('|')
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseDay(value: string, field: string, endOfDay: boolean): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new BadRequestException(`El parámetro "${field}" debe tener el formato AAAA-MM-DD`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = endOfDay ? new Date(y, mo - 1, d, 23, 59, 59, 999) : new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    throw new BadRequestException(`El parámetro "${field}" no es una fecha válida`);
  }
  return date;
}

function parsePositiveInt(value: string | undefined, fallback: number, field: string): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new BadRequestException(`El parámetro "${field}" debe ser un entero positivo`);
  return n;
}

/** Valida y normaliza los parámetros de consulta del listado de objetos. */
export function parseItemFilters(raw: RawItemQuery = {}): ItemFilters {
  const statuses = [...new Set(
    parseList(raw.status)
      .map(normalizeStatus)
      .filter((s): s is CanonicalStatus => s !== null),
  )];

  const from = raw.from ? parseDay(raw.from, 'from', false) : undefined;
  const to = raw.to ? parseDay(raw.to, 'to', true) : undefined;
  if (from && to && from > to) {
    throw new BadRequestException('La fecha "from" no puede ser posterior a "to"');
  }

  return {
    search: raw.search?.trim() || undefined,
    location: raw.location?.trim() || undefined,
    categories: parseList(raw.category),
    cities: parseList(raw.city),
    statuses,
    from,
    to,
    page: parsePositiveInt(raw.page, 1, 'page'),
    limit: Math.min(parsePositiveInt(raw.limit, DEFAULT_LIMIT, 'limit'), MAX_LIMIT),
  };
}
