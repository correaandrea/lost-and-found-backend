import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditEntry } from './audit-actions';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Registra una acción. Recibe opcionalmente el cliente de una transacción para que el
   * registro y el cambio auditado se confirmen (o se reviertan) juntos.
   */
  async record(entry: AuditEntry, client: any = this.prisma) {
    return client.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        itemId: entry.itemId ?? null,
        details: entry.details ? JSON.stringify(entry.details) : null,
      },
    });
  }

  async list(page: number, limit: number) {
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { actor: { select: { name: true, email: true } } },
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      logs: logs.map((l: any) => ({ ...l, details: l.details ? safeParse(l.details) : null })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}

function safeParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
