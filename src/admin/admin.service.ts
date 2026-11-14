import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit-actions';
import { PaginationQuery, parsePagination } from '../common/pagination';

export const ITEM_STATES = ['ACTIVE', 'RESOLVED'] as const;

export interface AdminItemsQuery extends PaginationQuery {
  state?: string;
  search?: string;
}

const pageInfo = (total: number, page: number, limit: number) => ({
  total,
  page,
  limit,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

/** Operaciones de moderación y supervisión reservadas al rol ADMIN. */
@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /** Todos los reportes (activos y resueltos), con quien los publicó. */
  async listItems(query: AdminItemsQuery = {}) {
    const { page, limit } = parsePagination(query);
    const where: any = {};

    if (query.state) {
      if (!ITEM_STATES.includes(query.state as any)) throw new BadRequestException('Estado inválido');
      where.state = query.state;
    }
    if (query.search?.trim()) {
      where.OR = [
        { title: { contains: query.search.trim(), mode: 'insensitive' } },
        { description: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { name: true, email: true } } },
      }),
      this.prisma.item.count({ where }),
    ]);

    return { items, ...pageInfo(total, page, limit) };
  }

  async deleteItem(id: number, adminId: number) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Objeto no encontrado');

    return this.prisma.$transaction(async (tx: any) => {
      const deleted = await tx.item.delete({ where: { id } });
      await this.audit.record(
        { actorId: adminId, action: AUDIT_ACTIONS.ITEM_DELETED_BY_ADMIN, itemId: id, details: { title: item.title, ownerId: item.userId } },
        tx,
      );
      return deleted;
    });
  }

  /** Cambio del estado de gestión de cualquier reporte (por ejemplo, reabrir uno marcado por error). */
  async setItemState(id: number, state: string, adminId: number, note?: string) {
    if (!ITEM_STATES.includes(state as any)) throw new BadRequestException('Estado inválido');
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Objeto no encontrado');
    if (item.state === state) throw new BadRequestException('El objeto ya se encuentra en ese estado');

    return this.prisma.$transaction(async (tx: any) => {
      const updated = await tx.item.update({
        where: { id },
        data: { state, resolvedAt: state === 'RESOLVED' ? new Date() : null },
      });
      await this.audit.record(
        {
          actorId: adminId,
          action: AUDIT_ACTIONS.ITEM_STATE_CHANGED,
          itemId: id,
          details: { from: item.state, to: state, note: note?.trim() || null },
        },
        tx,
      );
      return updated;
    });
  }

  listAudit(query: PaginationQuery = {}) {
    const { page, limit } = parsePagination(query, 50);
    return this.audit.list(page, limit);
  }
}
