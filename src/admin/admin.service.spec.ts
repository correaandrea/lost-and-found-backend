import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

jest.mock('@nestjs/common', () => jest.requireActual('../../test/nest-mocks'));
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../audit/audit.service', () => ({ AuditService: class {} }));

describe('AdminService', () => {
  let service: AdminService;
  const prisma = {
    item: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { record: jest.fn(), list: jest.fn() };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((cb: any) => cb(prisma));
    service = new AdminService(prisma as any, audit as any);
  });

  describe('listItems', () => {
    beforeEach(() => {
      prisma.item.findMany.mockResolvedValue([{ id: 1 }]);
      prisma.item.count.mockResolvedValue(41);
    });

    it('lista todos los reportes paginados, con quien los publicó', async () => {
      const result = await service.listItems({ page: '2', limit: '20' });

      expect(prisma.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, skip: 20, take: 20, orderBy: { createdAt: 'desc' } }),
      );
      expect(prisma.item.findMany.mock.calls[0][0].include).toHaveProperty('user');
      expect(result).toMatchObject({ total: 41, page: 2, totalPages: 3 });
    });

    it('filtra por estado y texto', async () => {
      await service.listItems({ state: 'RESOLVED', search: ' termo ' });

      const { where } = prisma.item.findMany.mock.calls[0][0];
      expect(where.state).toBe('RESOLVED');
      expect(where.OR[0]).toEqual({ title: { contains: 'termo', mode: 'insensitive' } });
    });

    it('rechaza estados inválidos', async () => {
      await expect(service.listItems({ state: 'BORRADO' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('deleteItem', () => {
    it('elimina el reporte y registra la moderación', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 5, title: 'Llaves', userId: 8 });
      prisma.item.delete.mockResolvedValue({ id: 5 });

      await service.deleteItem(5, 99);

      expect(prisma.item.delete).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(audit.record).toHaveBeenCalledWith(
        { actorId: 99, action: 'ITEM_DELETED_BY_ADMIN', itemId: 5, details: { title: 'Llaves', ownerId: 8 } },
        prisma,
      );
    });

    it('lanza NotFoundException si no existe', async () => {
      prisma.item.findUnique.mockResolvedValue(null);
      await expect(service.deleteItem(5, 99)).rejects.toBeInstanceOf(NotFoundException);
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('setItemState', () => {
    beforeEach(() => {
      prisma.item.findUnique.mockResolvedValue({ id: 5, state: 'RESOLVED' });
      prisma.item.update.mockResolvedValue({ id: 5, state: 'ACTIVE' });
    });

    it('cambia el estado y deja constancia del estado anterior y de la nota', async () => {
      await service.setItemState(5, 'ACTIVE', 99, ' Se entregó por error ');

      expect(prisma.item.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { state: 'ACTIVE', resolvedAt: null } });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 99,
          action: 'ITEM_STATE_CHANGED',
          itemId: 5,
          details: { from: 'RESOLVED', to: 'ACTIVE', note: 'Se entregó por error' },
        }),
        prisma,
      );
    });

    it('registra la fecha de resolución al marcar un reporte como resuelto', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 5, state: 'ACTIVE' });

      await service.setItemState(5, 'RESOLVED', 99);

      const { data } = prisma.item.update.mock.calls[0][0];
      expect(data.state).toBe('RESOLVED');
      expect(data.resolvedAt).toBeInstanceOf(Date);
    });

    it('valida el estado solicitado', async () => {
      await expect(service.setItemState(5, 'OTRO', 99)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza un cambio al mismo estado', async () => {
      await expect(service.setItemState(5, 'RESOLVED', 99)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.item.update).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el reporte no existe', async () => {
      prisma.item.findUnique.mockResolvedValue(null);
      await expect(service.setItemState(5, 'ACTIVE', 99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listAudit', () => {
    it('delega en la bitácora con 50 registros por página por defecto', async () => {
      audit.list.mockResolvedValue({ logs: [] });

      await service.listAudit({});
      await service.listAudit({ page: '3', limit: '10' });

      expect(audit.list).toHaveBeenNthCalledWith(1, 1, 50);
      expect(audit.list).toHaveBeenNthCalledWith(2, 3, 10);
    });

    it('rechaza paginación inválida', () => {
      expect(() => service.listAudit({ page: '0' })).toThrow(BadRequestException);
    });
  });
});
