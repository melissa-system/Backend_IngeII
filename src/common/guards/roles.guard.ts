import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Role } from '../enums/roles.enum';

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
      throw new ForbiddenException('No tienes permisos para realizar esta acción');
    }

    // 4. Regla de Oro: SUPER_ADMIN (Junta Directiva) tiene acceso total a cualquier módulo
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    // 5. Validar si el rol del usuario coincide con los roles permitidos
    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException('No tienes permisos suficientes para acceder a este recurso');
    }

    return true;
  }
}