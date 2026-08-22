import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Valida el Access Token (Bearer) en requests posteriores al login.
// La validación real la hace jwt.strategy.ts, que deja {id, role} en request.user.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
