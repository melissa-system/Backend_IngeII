import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

// Payload mínimo con el que los guards identifican quién hace cada request.
export interface JwtPayload {
  sub: number;
  role: string;
}

export interface RequestUser {
  id: number;
  role: string;
}

// Estrategia para requests posteriores al login: valida el Access Token
// (header Authorization: Bearer) y deja {id, role} en request.user.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: JwtPayload): RequestUser {
    return { id: payload.sub, role: payload.role };
  }
}
