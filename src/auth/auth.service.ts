import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async googleLogin(req: any) {
    if (!req.user) {
      return { error: 'No user from google' };
    }

    const { email, name, picture } = req.user;

    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          picture,
        },
      });
    }

    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role,
      name: user.name.split(' ')[0], 
      picture: user.picture 
    };
    const jwt = this.jwtService.sign(payload);

    return { token: jwt };
  }
}