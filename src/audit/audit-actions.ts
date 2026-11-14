/** Acciones que quedan registradas en la bitácora de auditoría. */
export const AUDIT_ACTIONS = {
  ITEM_CREATED: 'ITEM_CREATED',
  ITEM_DELETED: 'ITEM_DELETED',
  ITEM_DELETED_BY_ADMIN: 'ITEM_DELETED_BY_ADMIN',
  /** Quien publicó el reporte lo marca como resuelto (entregado o encontrado). */
  ITEM_RESOLVED: 'ITEM_RESOLVED',
  ITEM_REOPENED: 'ITEM_REOPENED',
  /** Cambio de estado realizado por un administrador. */
  ITEM_STATE_CHANGED: 'ITEM_STATE_CHANGED',
  /** Un usuario obtuvo el correo de contacto de quien publicó un reporte. */
  CONTACT_REQUESTED: 'CONTACT_REQUESTED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditEntry {
  actorId?: number | null;
  action: AuditAction;
  itemId?: number | null;
  details?: Record<string, unknown>;
}
