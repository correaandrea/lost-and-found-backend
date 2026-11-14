import { BadRequestException } from '@nestjs/common';
import { normalizeStatus, oppositeStatusVariants, parseItemFilters } from './item-filters';

jest.mock('@nestjs/common', () => jest.requireActual('../../test/nest-mocks'));

describe('parseItemFilters', () => {
  it('aplica valores por defecto', () => {
    expect(parseItemFilters()).toEqual({
      search: undefined,
      location: undefined,
      categories: [],
      cities: [],
      statuses: [],
      from: undefined,
      to: undefined,
      page: 1,
      limit: 20,
    });
  });

  it('separa listas por barra vertical (las sedes contienen comas), recorta espacios y elimina vacíos', () => {
    const f = parseItemFilters({ category: 'llaves| termos||', city: 'Amalfi, Colombia|Turbo, Colombia' });
    expect(f.categories).toEqual(['llaves', 'termos']);
    expect(f.cities).toEqual(['Amalfi, Colombia', 'Turbo, Colombia']);
  });

  it('normaliza los estados a lost/found sin duplicados y descarta los desconocidos', () => {
    expect(parseItemFilters({ status: 'perdido|lost|FOUND|otro' }).statuses).toEqual(['lost', 'found']);
  });

  it('interpreta "to" como el final del día', () => {
    const { to } = parseItemFilters({ to: '2026-11-07' });
    expect(to).toEqual(new Date(2026, 10, 7, 23, 59, 59, 999));
  });

  it.each(['2026-13-01', '2026-02-30', '07-11-2026', 'hoy'])('rechaza la fecha inválida %s', (bad) => {
    expect(() => parseItemFilters({ from: bad })).toThrow(BadRequestException);
  });

  it('rechaza un rango invertido', () => {
    expect(() => parseItemFilters({ from: '2026-11-10', to: '2026-11-01' })).toThrow(BadRequestException);
  });

  it('limita el tamaño de página y rechaza valores no positivos', () => {
    expect(parseItemFilters({ limit: '5000' }).limit).toBe(100);
    expect(() => parseItemFilters({ page: '0' })).toThrow(BadRequestException);
    expect(() => parseItemFilters({ limit: 'abc' })).toThrow(BadRequestException);
  });
});

describe('estado de los reportes', () => {
  it('reconoce las variantes en español e inglés', () => {
    expect(normalizeStatus(' Encontrado ')).toBe('found');
    expect(normalizeStatus('LOST')).toBe('lost');
    expect(normalizeStatus('x')).toBeNull();
  });

  it('devuelve las variantes del estado opuesto', () => {
    expect(oppositeStatusVariants('ENCONTRADO')).toContain('lost');
    expect(oppositeStatusVariants('lost')).toContain('ENCONTRADO');
    expect(oppositeStatusVariants('x')).toEqual([]);
  });
});
