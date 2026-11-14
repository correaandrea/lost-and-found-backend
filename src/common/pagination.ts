import { BadRequestException } from '@nestjs/common';

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

/** Valida los parámetros page y limit (limit máximo de 100). */
export function parsePagination(raw: PaginationQuery = {}, defaultLimit = 20) {
  const read = (value: string | undefined, fallback: number, field: string) => {
    if (value === undefined || value === '') return fallback;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) throw new BadRequestException(`El parámetro "${field}" debe ser un entero positivo`);
    return n;
  };
  return { page: read(raw.page, 1, 'page'), limit: Math.min(read(raw.limit, defaultLimit, 'limit'), 100) };
}
