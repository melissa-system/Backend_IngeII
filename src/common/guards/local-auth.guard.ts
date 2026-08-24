import {
  BadRequestException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Guardia del login inicial: dispara local.strategy.ts (email + contraseña).
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  // passport-local rechaza por su cuenta cuando faltan campos
  // ('Missing credentials'); se traduce a un 400 con mensaje claro.
  handleRequest<TUser>(
    err: unknown,
    user: TUser,
    info: { message?: string } | undefined,
    context: ExecutionContext,
  ): TUser {
    if (info?.message === 'Missing credentials') {
      throw new BadRequestException(
        'El correo y la contraseña son obligatorios',
      );
    }
    return super.handleRequest(err, user, info, context) as TUser;
  }
}
