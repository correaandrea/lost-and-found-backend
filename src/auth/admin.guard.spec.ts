import { ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { adminEmails, isAdmin, roleForEmail } from './roles';

jest.mock('@nestjs/common', () => jest.requireActual('../../test/nest-mocks'));

const contextWith = (user: unknown) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any;

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('permite el paso a un administrador', () => {
    expect(guard.canActivate(contextWith({ userId: 1, role: 'ADMIN' }))).toBe(true);
  });

  it.each([{ userId: 2, role: 'STUDENT' }, { userId: 3 }, undefined])('rechaza a %p', (user) => {
    expect(() => guard.canActivate(contextWith(user))).toThrow(ForbiddenException);
  });
});

describe('roles', () => {
  it('lee la lista de administradores sin importar espacios, mayúsculas ni vacíos', () => {
    expect(adminEmails(' A@udea.edu.co ,, b@udea.edu.co')).toEqual(['a@udea.edu.co', 'b@udea.edu.co']);
    expect(adminEmails('')).toEqual([]);
    expect(adminEmails(undefined)).toEqual(expect.any(Array));
  });

  it('asigna el rol según la lista', () => {
    expect(roleForEmail('A@udea.edu.co', 'a@udea.edu.co')).toBe('ADMIN');
    expect(roleForEmail('c@udea.edu.co', 'a@udea.edu.co')).toBe('STUDENT');
    expect(roleForEmail('c@udea.edu.co', '')).toBe('STUDENT');
  });

  it('isAdmin solo reconoce el rol ADMIN', () => {
    expect(isAdmin({ userId: 1, role: 'ADMIN' })).toBe(true);
    expect(isAdmin({ userId: 1, role: 'STUDENT' })).toBe(false);
    expect(isAdmin({ userId: 1 })).toBe(false);
  });
});
