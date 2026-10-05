import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Role } from '../enums/roles.enum';
import { ORIGEN_AUTORIZACION } from '../errores/respuesta-error';

// Guard de roles. Los 403 que lanza llevan `origen: 'autorizacion'` para que
// el frontend los distinga de otros ForbiddenException que el backend lanza
// por causas ajenas a los permisos (reCAPTCHA, reglas de negocio): solo estos
// abren la pantalla de "Acceso denegado".
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Si la ruta está marcada como @Public(), se permite el acceso sin validar roles
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 2. Obtener los roles requeridos para la ruta
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si la ruta no especifica ningún rol, se permite el paso
    if (!requiredRoles) {
      return true;
    }

    // 3. Extraer el usuario autenticado del request (inyectado por el middleware/token)
    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new ForbiddenException({
        message: 'No tienes permisos para realizar esta acción',
        origen: ORIGEN_AUTORIZACION,
      });
    }

    // 4. Regla de Oro: SUPER_ADMIN (Junta Directiva) tiene acceso total a cualquier módulo
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    // 5. Validar si el rol del usuario coincide con los roles permitidos
    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException({
        message: 'No tienes permisos suficientes para acceder a este recurso',
        origen: ORIGEN_AUTORIZACION,
      });
    }

    return true;
  }
}