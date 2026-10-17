import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '',
      scope: ['email', 'profile'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
    const { name, emails, photos } = profile;
    const email = emails[0].value;

    if (!email.endsWith('@udea.edu.co')) {
      return done(new UnauthorizedException('Acceso denegado: Usa tu correo institucional de la UdeA'), false);
    }

    const user = {
      email,
      name: `${name.givenName} ${name.familyName}`,
      picture: photos[0].value,
    };
    
    done(null, user);
  }
}