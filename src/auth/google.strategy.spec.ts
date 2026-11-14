import { UnauthorizedException } from '@nestjs/common';
import { GoogleStrategy } from './google.strategy';

jest.mock('@nestjs/common', () => jest.requireActual('../../test/nest-mocks'));
jest.mock('@nestjs/passport', () => ({ PassportStrategy: () => class {} }));
jest.mock('passport-google-oauth20', () => ({ Strategy: class {} }));

describe('GoogleStrategy.validate', () => {
  const strategy = new GoogleStrategy();
  const profile = (email: string) => ({
    name: { givenName: 'Ana', familyName: 'Pérez' },
    emails: [{ value: email }],
    photos: [{ value: 'http://p/a.png' }],
  });

  it('acepta correos del dominio institucional', async () => {
    const done = jest.fn();

    await strategy.validate('at', 'rt', profile('ana@udea.edu.co'), done);

    expect(done).toHaveBeenCalledWith(null, {
      email: 'ana@udea.edu.co',
      name: 'Ana Pérez',
      picture: 'http://p/a.png',
    });
  });

  it('rechaza correos de otros dominios', async () => {
    const done = jest.fn();

    await strategy.validate('at', 'rt', profile('ana@gmail.com'), done);

    expect(done).toHaveBeenCalledWith(expect.any(UnauthorizedException), false);
  });

  it('rechaza dominios que solo contienen el institucional como subcadena', async () => {
    const done = jest.fn();

    await strategy.validate('at', 'rt', profile('ana@udea.edu.co.falso.com'), done);

    expect(done).toHaveBeenCalledWith(expect.any(UnauthorizedException), false);
  });
});
