/**
 * El detalle privado de verificación solo debe verlo quien publicó el objeto y los
 * administradores. En las respuestas públicas se sustituye por un indicador booleano.
 */
export function toPublicItem<T extends { privateDetail?: string | null }>(item: T) {
  const { privateDetail, ...rest } = item;
  return { ...rest, hasPrivateDetail: Boolean(privateDetail) };
}

/** Versión para el propio autor: conserva el detalle privado. */
export function toOwnerItem<T extends { privateDetail?: string | null }>(item: T) {
  return { ...item, hasPrivateDetail: Boolean(item.privateDetail) };
}
