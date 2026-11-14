import { Injectable, BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit-actions';
import { RawItemQuery, STATUS_VARIANTS, normalizeStatus, oppositeStatusVariants, parseItemFilters } from './item-filters';
import { rankMatches } from './matching';
import { toOwnerItem, toPublicItem } from './public-item';

/** Máximo de reportes recientes que se comparan al buscar coincidencias. */
const MATCH_CANDIDATE_LIMIT = 200;
const MAX_PRIVATE_DETAIL_LENGTH = 500;
const MAX_NOTE_LENGTH = 500;

export const ITEM_STATES = ['ACTIVE', 'RESOLVED'] as const;
export type ItemState = (typeof ITEM_STATES)[number];

@Injectable()
export class ItemsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
    private audit: AuditService,
  ) {}

  async create(data: any, file: any, userId: number) {
    let uploadedUrl = null;
    if (file) {
      try {
        const uploadResult = await this.cloudinary.uploadImage(file);
        uploadedUrl = uploadResult.secure_url;
      } catch {
        throw new BadRequestException('Error al subir la imagen');
      }
    }

    // El detalle privado solo aplica a objetos encontrados: es lo que el dueño debe acertar al contactar
    const rawDetail = typeof data.privateDetail === 'string' ? data.privateDetail.trim() : '';
    if (rawDetail.length > MAX_PRIVATE_DETAIL_LENGTH) {
      throw new BadRequestException(`El detalle privado no puede superar ${MAX_PRIVATE_DETAIL_LENGTH} caracteres`);
    }
    const privateDetail = normalizeStatus(String(data.status ?? '')) === 'found' && rawDetail ? rawDetail : null;

    const item = await this.prisma.item.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        city: data.city,
        location: data.location,
        status: data.status,
        privateDetail,
        imageUrl: uploadedUrl,
        userId: userId, // Asociamos el objeto al usuario (y con él, su correo de contacto)
      },
    });

    await this.audit.record({
      actorId: userId,
      action: AUDIT_ACTIONS.ITEM_CREATED,
      itemId: item.id,
      details: { title: item.title, status: item.status },
    });

    return toOwnerItem(item);
  }

  /**
   * Listado público con filtros combinables (texto, sede, ubicación, categoría, estado y rango de
   * fechas de publicación) y paginación en el servidor. Solo incluye reportes aún activos.
   */
  async findAll(raw: RawItemQuery = {}) {
    const filters = parseItemFilters(raw);
    const where: any = { state: 'ACTIVE' };

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.location) {
      where.location = { contains: filters.location, mode: 'insensitive' };
    }
    if (filters.categories.length > 0) {
      where.category = { in: filters.categories, mode: 'insensitive' };
    }
    if (filters.cities.length > 0) {
      where.city = { in: filters.cities };
    }
    if (filters.statuses.length > 0) {
      where.status = { in: filters.statuses.flatMap((s) => STATUS_VARIANTS[s]) };
    }
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.item.count({ where }),
    ]);

    return {
      items: items.map(toPublicItem),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    };
  }

  /**
   * Sugiere posibles coincidencias para un reporte: objetos activos con el estado opuesto
   * (perdido ↔ encontrado) de la misma categoría y sede, ordenados por similitud textual.
   */
  async findMatches(id: number) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Objeto no encontrado');

    const candidates = await this.prisma.item.findMany({
      where: {
        id: { not: id },
        state: 'ACTIVE',
        category: item.category,
        city: item.city,
        status: { in: oppositeStatusVariants(item.status) },
      },
      orderBy: { createdAt: 'desc' },
      take: MATCH_CANDIDATE_LIMIT,
    });

    return rankMatches(item, candidates.map(toPublicItem));
  }

  async findMyItems(userId: number) {
    const items = await this.prisma.item.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return items.map(toOwnerItem);
  }

  async findOne(id: number) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    return item ? toPublicItem(item) : null;
  }

  /**
   * Datos de contacto de quien publicó un reporte. Solo se entregan a usuarios autenticados
   * (para no exponer correos a visitantes anónimos) y cada consulta queda en la bitácora.
   */
  async getContact(id: number, requesterId: number) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!item) throw new NotFoundException('Objeto no encontrado');
    if (!item.user) throw new BadRequestException('Este reporte no tiene un contacto asociado');
    if (item.userId === requesterId) throw new BadRequestException('Este reporte es tuyo');
    if (item.state !== 'ACTIVE') throw new BadRequestException('Este objeto ya fue resuelto');

    await this.audit.record({
      actorId: requesterId,
      action: AUDIT_ACTIONS.CONTACT_REQUESTED,
      itemId: id,
      details: { title: item.title },
    });

    return {
      name: item.user.name,
      email: item.user.email,
      title: item.title,
      status: item.status,
      hasPrivateDetail: Boolean(item.privateDetail),
    };
  }

  /**
   * Quien publicó un reporte lo marca como resuelto (entregado, si era un objeto encontrado;
   * recuperado, si era uno perdido) o lo reabre. El cambio queda en la bitácora.
   */
  async setState(id: number, state: string, userId: number, note?: string) {
    if (!ITEM_STATES.includes(state as ItemState)) throw new BadRequestException('Estado inválido');

    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Objeto no encontrado');
    if (item.userId !== userId) throw new ForbiddenException('Solo quien publicó el objeto puede cambiar su estado');
    if (item.state === state) throw new BadRequestException('El objeto ya se encuentra en ese estado');

    const cleanNote = typeof note === 'string' ? note.trim().slice(0, MAX_NOTE_LENGTH) || null : null;
    const resolved = state === 'RESOLVED';

    return this.prisma.$transaction(async (tx: any) => {
      const updated = await tx.item.update({
        where: { id },
        data: { state, resolvedAt: resolved ? new Date() : null },
      });
      await this.audit.record(
        {
          actorId: userId,
          action: resolved ? AUDIT_ACTIONS.ITEM_RESOLVED : AUDIT_ACTIONS.ITEM_REOPENED,
          itemId: id,
          details: { title: item.title, status: item.status, note: cleanNote },
        },
        tx,
      );
      return toOwnerItem(updated);
    });
  }

  async remove(id: number, userId: number) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new BadRequestException('Objeto no encontrado');
    if (item.userId !== userId) throw new UnauthorizedException('Solo puedes borrar tus propios objetos');

    const deleted = await this.prisma.item.delete({ where: { id } });
    await this.audit.record({
      actorId: userId,
      action: AUDIT_ACTIONS.ITEM_DELETED,
      itemId: id,
      details: { title: item.title },
    });
    return deleted;
  }
}
