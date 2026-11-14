export const ROLES = { STUDENT: 'STUDENT', ADMIN: 'ADMIN' } as const;

/** Correos con rol de administrador, definidos en la variable de entorno ADMIN_EMAILS (separados por coma). */
export function adminEmails(env: string | undefined = process.env.ADMIN_EMAILS): string[] {
  return (env ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function roleForEmail(email: string, env?: string): string {
  return adminEmails(env).includes(email.trim().toLowerCase()) ? ROLES.ADMIN : ROLES.STUDENT;
}

/** Usuario autenticado tal como lo entrega la estrategia JWT. */
export interface Actor {
  userId: number;
  email?: string;
  role?: string;
}

export const isAdmin = (actor: Actor) => actor.role === ROLES.ADMIN;
