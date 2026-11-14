import { AuditService } from './audit.service';

jest.mock('@nestjs/common', () => jest.requireActual('../../test/nest-mocks'));
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('AuditService', () => {
  const prisma = { auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() } };
  let service: AuditService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AuditService(prisma as any);
  });

  it('registra la acción serializando los detalles', async () => {
    await service.record({ actorId: 3, action: 'CONTACT_REQUESTED', itemId: 9, details: { title: 'Termo' } });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: { actorId: 3, action: 'CONTACT_REQUESTED', itemId: 9, details: '{"title":"Termo"}' },
    });
  });

  it('usa nulos para los campos opcionales ausentes', async () => {
    await service.record({ action: 'ITEM_DELETED' });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: { actorId: null, action: 'ITEM_DELETED', itemId: null, details: null },
    });
  });

  it('escribe en el cliente de la transacción cuando se le entrega uno', async () => {
    const tx = { auditLog: { create: jest.fn() } };

    await service.record({ action: 'ITEM_DELETED' }, tx);

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('lista la bitácora de más reciente a más antigua y deserializa los detalles', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      { id: 2, details: '{"a":1}', actor: { name: 'Ana', email: 'a@udea.edu.co' } },
      { id: 1, details: null, actor: null },
      { id: 0, details: 'no-es-json', actor: null },
    ]);
    prisma.auditLog.count.mockResolvedValue(120);

    const result = await service.list(2, 50);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, skip: 50, take: 50 }),
    );
    expect(result.logs.map((l: any) => l.details)).toEqual([{ a: 1 }, null, 'no-es-json']);
    expect(result).toMatchObject({ total: 120, page: 2, totalPages: 3 });
  });
});
