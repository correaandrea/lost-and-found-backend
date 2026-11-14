/**
 * Cruce de coincidencias entre reportes de objetos perdidos y encontrados.
 * Calcula un puntaje de similitud en [0, 1] a partir del texto del título, de la
 * descripción y de la ubicación, sin depender de servicios externos.
 */

export interface Matchable {
  title: string;
  description: string;
  location: string;
}

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'en', 'con', 'sin',
  'por', 'para', 'que', 'y', 'o', 'a', 'se', 'su', 'sus', 'mi', 'mis', 'es', 'esta', 'este',
  'ese', 'esa', 'les', 'lo', 'como', 'muy', 'hay', 'fue', 'ser', 'tiene', 'tipo',
]);

export const MIN_MATCH_SCORE = 0.2;
export const MAX_MATCHES = 5;

/** Convierte un texto en un conjunto de términos significativos (sin tildes ni palabras vacías). */
export function tokenize(text: string): Set<string> {
  const normalized = (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const tokens = normalized
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  return new Set(tokens);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Puntaje de similitud entre dos reportes: 40 % título, 35 % texto completo y 25 % ubicación.
 * La ubicación por sí sola no basta: se exige alguna coincidencia en título o descripción.
 */
export function scoreMatch(a: Matchable, b: Matchable): number {
  const titleSim = jaccard(tokenize(a.title), tokenize(b.title));
  const textSim = jaccard(tokenize(`${a.title} ${a.description}`), tokenize(`${b.title} ${b.description}`));
  if (titleSim === 0 && textSim === 0) return 0;
  const locationSim = jaccard(tokenize(a.location), tokenize(b.location));
  const score = 0.4 * titleSim + 0.35 * textSim + 0.25 * locationSim;
  return Math.round(score * 100) / 100;
}

/** Ordena los candidatos por puntaje descendente y descarta los que no alcanzan el mínimo. */
export function rankMatches<T extends Matchable>(
  source: Matchable,
  candidates: T[],
  { limit = MAX_MATCHES, minScore = MIN_MATCH_SCORE } = {},
): Array<T & { matchScore: number }> {
  return candidates
    .map((item) => ({ ...item, matchScore: scoreMatch(source, item) }))
    .filter((m) => m.matchScore >= minScore)
    .sort((x, y) => y.matchScore - x.matchScore)
    .slice(0, limit);
}
