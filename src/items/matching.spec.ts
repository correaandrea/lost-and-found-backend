import { jaccard, rankMatches, scoreMatch, tokenize } from './matching';

const item = (title: string, description = '', location = '') => ({ title, description, location });

describe('tokenize', () => {
  it('ignora tildes, mayúsculas, palabras vacías y términos cortos', () => {
    expect([...tokenize('El Termo AZUL de la Cafetería')]).toEqual(['termo', 'azul', 'cafeteria']);
  });

  it('tolera textos vacíos', () => {
    expect(tokenize('').size).toBe(0);
  });
});

describe('jaccard', () => {
  it('mide la proporción de términos compartidos', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3);
    expect(jaccard(new Set(['a']), new Set(['a']))).toBe(1);
    expect(jaccard(new Set(), new Set(['a']))).toBe(0);
  });
});

describe('scoreMatch', () => {
  it('da el puntaje máximo a reportes idénticos', () => {
    const a = item('Termo azul', 'Con calcomanía', 'Bloque 22');
    expect(scoreMatch(a, { ...a })).toBe(1);
  });

  it('reconoce el mismo objeto aunque cambien tildes y mayúsculas', () => {
    expect(scoreMatch(item('CALCULADORA científica'), item('calculadora Cientifica'))).toBeGreaterThanOrEqual(0.75);
  });

  it('es 0 si no hay términos en común, aunque coincida la ubicación', () => {
    expect(scoreMatch(item('Termo azul', '', 'Bloque 22'), item('Cuaderno rojo', '', 'Bloque 22'))).toBe(0);
  });

  it('es simétrico', () => {
    const a = item('Llaves con llavero rojo', 'Tres llaves', 'Biblioteca');
    const b = item('Llavero rojo', 'Llaves', 'Biblioteca central');
    expect(scoreMatch(a, b)).toBe(scoreMatch(b, a));
  });
});

describe('rankMatches', () => {
  const source = item('Termo azul', 'Termo azul con calcomanía', 'Bloque 22');
  const candidates = [
    { id: 1, ...item('Cuaderno', 'Cuadriculado', 'Biblioteca') },
    { id: 2, ...item('Termo', 'Botella metálica', 'Cafetería') },
    { id: 3, ...item('Termo azul', 'Termo azul con calcomanía', 'Bloque 22') },
  ];

  it('ordena por puntaje y descarta los que no alcanzan el mínimo', () => {
    const ranked = rankMatches(source, candidates);
    expect(ranked.map((r) => r.id)).toEqual([3, 2]);
    expect(ranked[0].matchScore).toBe(1);
  });

  it('respeta el límite de resultados', () => {
    expect(rankMatches(source, candidates, { limit: 1 })).toHaveLength(1);
  });

  it('no modifica los candidatos originales', () => {
    rankMatches(source, candidates);
    expect(candidates[0]).not.toHaveProperty('matchScore');
  });
});
