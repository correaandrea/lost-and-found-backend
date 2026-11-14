import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ROLES } from './roles';

/** Restringe una ruta a usuarios con rol ADMIN. Debe usarse después del guard JWT. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.user?.role !== ROLES.ADMIN) {
      throw new ForbiddenException('Se requiere rol de administrador');
    }
    return true;
  }
}
