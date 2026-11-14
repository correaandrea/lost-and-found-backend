import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ItemsService } from './items.service';

jest.mock('@nestjs/common', () => jest.requireActual('../../test/nest-mocks'));

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../cloudinary/cloudinary.service', () => ({ CloudinaryService: class {} }));

describe('ItemsService', () => {
  let service: ItemsService;
  const prisma = {
    item: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const cloudinary = { uploadImage: jest.fn() };
  const audit = { record: jest.fn() };

  const body = {
    title: 'Termo azul',
    description: 'Termo con calcomanía',
    category: 'termos',
    city: 'Medellín, Colombia',
    location: 'Bloque 22',
    status: 'lost',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((cb: any) => cb(prisma));
    service = new ItemsService(prisma as any, cloudinary as any, audit as any);
  });

  describe('create', () => {
    it('sube la imagen y guarda su URL asociada al usuario', async () => {
      cloudinary.uploadImage.mockResolvedValue({ secure_url: 'https://img/x.jpg' });
      prisma.item.create.mockResolvedValue({ id: 1 });

      await service.create(body, { buffer: Buffer.from('a') }, 7);

      expect(cloudinary.uploadImage).toHaveBeenCalledTimes(1);
      expect(prisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ title: 'Termo azul', imageUrl: 'https://img/x.jpg', userId: 7 }),
      });
    });

    it('permite publicar sin imagen (imageUrl nulo)', async () => {
      prisma.item.create.mockResolvedValue({ id: 2 });

      await service.create(body, undefined, 7);

      expect(cloudinary.uploadImage).not.toHaveBeenCalled();
      expect(prisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ imageUrl: null, userId: 7 }),
      });
    });

    it('registra la publicación en la bitácora de auditoría', async () => {
      prisma.item.create.mockResolvedValue({ id: 4, title: 'Termo azul', status: 'lost' });

      await service.create(body, undefined, 7);

      expect(audit.record).toHaveBeenCalledWith({
        actorId: 7,
        action: 'ITEM_CREATED',
        itemId: 4,
        details: { title: 'Termo azul', status: 'lost' },
      });
    });

    it('guarda el detalle privado solo en objetos encontrados', async () => {
      prisma.item.create.mockResolvedValue({ id: 5, title: 'x', status: 'found' });

      await service.create({ ...body, status: 'found', privateDetail: '  Pantalla rota  ' }, undefined, 7);
      await service.create({ ...body, status: 'lost', privateDetail: 'Pantalla rota' }, undefined, 7);
      await service.create({ ...body, status: 'found', privateDetail: '   ' }, undefined, 7);

      const details = prisma.item.create.mock.calls.map(([arg]) => arg.data.privateDetail);
      expect(details).toEqual(['Pantalla rota', null, null]);
    });

    it('rechaza un detalle privado demasiado largo', async () => {
      await expect(
        service.create({ ...body, status: 'found', privateDetail: 'x'.repeat(501) }, undefined, 7),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.item.create).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si falla la subida y no guarda el objeto', async () => {
      cloudinary.uploadImage.mockRejectedValue(new Error('cloudinary down'));

      await expect(service.create(body, { buffer: Buffer.from('a') }, 7)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.item.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      prisma.item.findMany.mockResolvedValue([]);
      prisma.item.count.mockResolvedValue(0);
    });

    const whereOf = () => prisma.item.findMany.mock.calls[0][0].where;

    it('sin filtros consulta todo ordenado por fecha y paginado', async () => {
      const result = await service.findAll();

      expect(prisma.item.findMany).toHaveBeenCalledWith({
        where: { state: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20, totalPages: 1 });
    });

    it('solo lista objetos activos y oculta el detalle privado', async () => {
      prisma.item.findMany.mockResolvedValue([{ id: 1, title: 'Celular', privateDetail: 'Funda con grieta' }]);
      prisma.item.count.mockResolvedValue(1);

      const result = await service.findAll({ status: 'found' });

      expect(whereOf().state).toBe('ACTIVE');
      expect(result.items[0]).not.toHaveProperty('privateDetail');
      expect(result.items[0]).toMatchObject({ id: 1, hasPrivateDetail: true });
    });

    it('busca por texto en título o descripción sin distinguir mayúsculas', async () => {
      await service.findAll({ search: 'termo' });

      expect(whereOf().OR).toEqual([
        { title: { contains: 'termo', mode: 'insensitive' } },
        { description: { contains: 'termo', mode: 'insensitive' } },
      ]);
    });

    it('combina ubicación, categorías, sedes y estado', async () => {
      await service.findAll({
        location: 'bloque',
        category: 'llaves|termos',
        city: 'Medellín, Colombia',
        status: 'lost',
      });

      const where = whereOf();
      expect(where.location).toEqual({ contains: 'bloque', mode: 'insensitive' });
      expect(where.category).toEqual({ in: ['llaves', 'termos'], mode: 'insensitive' });
      expect(where.city).toEqual({ in: ['Medellín, Colombia'] });
      expect(where.status.in).toEqual(expect.arrayContaining(['PERDIDO', 'lost']));
      expect(where.status.in).not.toContain('found');
    });

    it('normaliza las variantes del estado y admite ambos estados', async () => {
      await service.findAll({ status: 'found|perdido' });

      expect(whereOf().status.in).toEqual(expect.arrayContaining(['ENCONTRADO', 'found', 'PERDIDO', 'lost']));
    });

    it('filtra por rango de fechas de publicación', async () => {
      await service.findAll({ from: '2026-11-01', to: '2026-11-07' });

      const { createdAt } = whereOf();
      expect(createdAt.gte).toEqual(new Date(2026, 10, 1, 0, 0, 0, 0));
      expect(createdAt.lte).toEqual(new Date(2026, 10, 7, 23, 59, 59, 999));
    });

    it('admite un rango abierto (solo desde)', async () => {
      await service.findAll({ from: '2026-11-01' });

      expect(whereOf().createdAt).toEqual({ gte: new Date(2026, 10, 1, 0, 0, 0, 0) });
    });

    it('pagina en el servidor y calcula el total de páginas', async () => {
      prisma.item.count.mockResolvedValue(45);

      const result = await service.findAll({ page: '3', limit: '20' });

      expect(prisma.item.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 20 }));
      expect(result).toMatchObject({ total: 45, page: 3, limit: 20, totalPages: 3 });
    });

    it('rechaza parámetros inválidos sin consultar la base de datos', async () => {
      await expect(service.findAll({ from: '01/11/2026' })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.item.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findMatches', () => {
    const lost = {
      id: 1,
      title: 'Termo azul',
      description: 'Termo azul con calcomanía de Linux',
      location: 'Bloque 22',
      category: 'termos',
      city: 'Medellín, Colombia',
      status: 'lost',
    };

    it('consulta solo reportes del estado opuesto, misma categoría y misma sede', async () => {
      prisma.item.findUnique.mockResolvedValue(lost);
      prisma.item.findMany.mockResolvedValue([]);

      await service.findMatches(1);

      const { where } = prisma.item.findMany.mock.calls[0][0];
      expect(where.id).toEqual({ not: 1 });
      expect(where.state).toBe('ACTIVE');
      expect(where.category).toBe('termos');
      expect(where.city).toBe('Medellín, Colombia');
      expect(where.status.in).toEqual(expect.arrayContaining(['ENCONTRADO', 'found']));
      expect(where.status.in).not.toContain('lost');
    });

    it('devuelve las coincidencias ordenadas y descarta las no relacionadas', async () => {
      prisma.item.findUnique.mockResolvedValue(lost);
      prisma.item.findMany.mockResolvedValue([
        { id: 2, title: 'Termo azul', description: 'Termo azul con calcomanía', location: 'Bloque 22' },
        { id: 3, title: 'Cuaderno rojo', description: 'Cuadriculado', location: 'Biblioteca' },
        { id: 4, title: 'Termo', description: 'Botella metálica', location: 'Cafetería' },
      ]);

      const matches = await service.findMatches(1);

      expect(matches.map((m) => m.id)).toEqual([2, 4]);
      expect(matches[0].matchScore).toBeGreaterThan(matches[1].matchScore);
    });

    it('lanza NotFoundException si el reporte no existe', async () => {
      prisma.item.findUnique.mockResolvedValue(null);

      await expect(service.findMatches(99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getContact', () => {
    const published = {
      id: 1,
      title: 'Celular negro',
      status: 'found',
      state: 'ACTIVE',
      userId: 10,
      privateDetail: 'Pantalla rota',
      user: { name: 'Ana Pérez', email: 'ana@udea.edu.co' },
    };

    it('entrega el correo de quien publicó y deja constancia en la bitácora', async () => {
      prisma.item.findUnique.mockResolvedValue(published);

      const result = await service.getContact(1, 20);

      expect(result).toEqual({
        name: 'Ana Pérez',
        email: 'ana@udea.edu.co',
        title: 'Celular negro',
        status: 'found',
        hasPrivateDetail: true,
      });
      expect(result).not.toHaveProperty('privateDetail');
      expect(audit.record).toHaveBeenCalledWith({
        actorId: 20,
        action: 'CONTACT_REQUESTED',
        itemId: 1,
        details: { title: 'Celular negro' },
      });
    });

    it('lanza NotFoundException si el reporte no existe', async () => {
      prisma.item.findUnique.mockResolvedValue(null);
      await expect(service.getContact(1, 20)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('no entrega contacto de reportes sin autor, propios o ya resueltos y no registra la consulta', async () => {
      prisma.item.findUnique.mockResolvedValueOnce({ ...published, user: null });
      await expect(service.getContact(1, 20)).rejects.toBeInstanceOf(BadRequestException);

      prisma.item.findUnique.mockResolvedValueOnce(published);
      await expect(service.getContact(1, 10)).rejects.toBeInstanceOf(BadRequestException);

      prisma.item.findUnique.mockResolvedValueOnce({ ...published, state: 'RESOLVED' });
      await expect(service.getContact(1, 20)).rejects.toBeInstanceOf(BadRequestException);

      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('setState', () => {
    const mine = { id: 1, title: 'Llaves', status: 'lost', state: 'ACTIVE', userId: 5 };

    beforeEach(() => {
      prisma.item.findUnique.mockResolvedValue(mine);
      prisma.item.update.mockImplementation(async ({ data }: any) => ({ ...mine, ...data }));
    });

    it('marca el reporte como resuelto, guarda la fecha y lo registra en la bitácora', async () => {
      const result = await service.setState(1, 'RESOLVED', 5, '  Ya apareció  ');

      const { data } = prisma.item.update.mock.calls[0][0];
      expect(data.state).toBe('RESOLVED');
      expect(data.resolvedAt).toBeInstanceOf(Date);
      expect(result.state).toBe('RESOLVED');
      expect(audit.record).toHaveBeenCalledWith(
        { actorId: 5, action: 'ITEM_RESOLVED', itemId: 1, details: { title: 'Llaves', status: 'lost', note: 'Ya apareció' } },
        prisma,
      );
    });

    it('permite reabrir un reporte resuelto y borra la fecha de resolución', async () => {
      prisma.item.findUnique.mockResolvedValue({ ...mine, state: 'RESOLVED' });

      await service.setState(1, 'ACTIVE', 5);

      expect(prisma.item.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { state: 'ACTIVE', resolvedAt: null } });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ITEM_REOPENED' }), prisma);
    });

    it('solo permite cambiarlo a quien publicó el reporte', async () => {
      await expect(service.setState(1, 'RESOLVED', 99)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.item.update).not.toHaveBeenCalled();
    });

    it('valida el estado y rechaza repetirlo', async () => {
      await expect(service.setState(1, 'BORRADO', 5)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.setState(1, 'ACTIVE', 5)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lanza NotFoundException si el reporte no existe', async () => {
      prisma.item.findUnique.mockResolvedValue(null);
      await expect(service.setState(1, 'RESOLVED', 5)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findMyItems y findOne', () => {
    it('findMyItems filtra por usuario (incluye los resueltos) y conserva el detalle privado', async () => {
      prisma.item.findMany.mockResolvedValue([{ id: 1, privateDetail: 'secreto', state: 'RESOLVED' }]);

      const result = await service.findMyItems(3);

      expect(prisma.item.findMany).toHaveBeenCalledWith({ where: { userId: 3 }, orderBy: { createdAt: 'desc' } });
      expect(result).toEqual([{ id: 1, privateDetail: 'secreto', state: 'RESOLVED', hasPrivateDetail: true }]);
    });

    it('findOne consulta por identificador y no expone el detalle privado', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 9, privateDetail: 'secreto' });

      const result = await service.findOne(9);

      expect(prisma.item.findUnique).toHaveBeenCalledWith({ where: { id: 9 } });
      expect(result).toEqual({ id: 9, hasPrivateDetail: true });
    });

    it('findOne devuelve nulo si no existe', async () => {
      prisma.item.findUnique.mockResolvedValue(null);
      await expect(service.findOne(9)).resolves.toBeNull();
    });
  });

  describe('remove', () => {
    it('elimina el objeto si el usuario es el autor', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 1, userId: 5, title: 'Llaves' });
      prisma.item.delete.mockResolvedValue({ id: 1 });

      await service.remove(1, 5);

      expect(prisma.item.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(audit.record).toHaveBeenCalledWith({
        actorId: 5,
        action: 'ITEM_DELETED',
        itemId: 1,
        details: { title: 'Llaves' },
      });
    });

    it('rechaza la eliminación si el usuario no es el autor', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 1, userId: 5 });

      await expect(service.remove(1, 99)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.item.delete).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si el objeto no existe', async () => {
      prisma.item.findUnique.mockResolvedValue(null);

      await expect(service.remove(1, 5)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
