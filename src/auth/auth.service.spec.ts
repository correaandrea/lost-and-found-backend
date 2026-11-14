import { AuthService } from './auth.service';

jest.mock('@nestjs/common', () => jest.requireActual('../../test/nest-mocks'));
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('AuthService', () => {
  let service: AuthService;
  const prisma = { user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } };
  const jwt = { sign: jest.fn() };

  const googleUser = { email: 'ana.perez@udea.edu.co', name: 'Ana Pérez', picture: 'http://p/a.png' };
  const originalAdmins = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.ADMIN_EMAILS;
    jwt.sign.mockReturnValue('token-firmado');
    service = new AuthService(prisma as any, jwt as any);
  });

  afterAll(() => {
    if (originalAdmins === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = originalAdmins;
  });

  it('devuelve error si Google no entrega usuario', async () => {
    await expect(service.googleLogin({})).resolves.toEqual({ error: 'No user from google' });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('registra al usuario como estudiante en el primer ingreso', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 1, ...googleUser, role: 'STUDENT' });

    const result = await service.googleLogin({ user: googleUser });

    expect(prisma.user.create).toHaveBeenCalledWith({ data: { ...googleUser, role: 'STUDENT' } });
    expect(result).toEqual({ token: 'token-firmado' });
  });

  it('no duplica al usuario si ya existe', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1, ...googleUser, role: 'STUDENT' });

    await service.googleLogin({ user: googleUser });

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('asigna rol ADMIN a los correos de ADMIN_EMAILS al registrarse', async () => {
    process.env.ADMIN_EMAILS = 'otra@udea.edu.co, Ana.Perez@udea.edu.co';
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 1, ...googleUser, role: 'ADMIN' });

    await service.googleLogin({ user: googleUser });

    expect(prisma.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ role: 'ADMIN' }) });
  });

  it('promueve a un usuario existente cuando su correo pasa a ser administrador', async () => {
    process.env.ADMIN_EMAILS = googleUser.email;
    prisma.user.findUnique.mockResolvedValue({ id: 4, ...googleUser, role: 'STUDENT' });
    prisma.user.update.mockResolvedValue({ id: 4, ...googleUser, role: 'ADMIN' });

    await service.googleLogin({ user: googleUser });

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 4 }, data: { role: 'ADMIN' } });
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ role: 'ADMIN' }));
  });

  it('revoca el rol de quien ya no está en ADMIN_EMAILS', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 4, ...googleUser, role: 'ADMIN' });
    prisma.user.update.mockResolvedValue({ id: 4, ...googleUser, role: 'STUDENT' });

    await service.googleLogin({ user: googleUser });

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 4 }, data: { role: 'STUDENT' } });
  });

  it('firma un JWT con id, correo, rol, primer nombre y foto', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 4, ...googleUser, role: 'STUDENT' });

    await service.googleLogin({ user: googleUser });

    expect(jwt.sign).toHaveBeenCalledWith({
      sub: 4,
      email: googleUser.email,
      role: 'STUDENT',
      name: 'Ana',
      picture: googleUser.picture,
    });
  });
});
