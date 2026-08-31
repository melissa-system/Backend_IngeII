import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

// Payload mínimo con el que los guards identifican quién hace cada request.
export interface JwtPayload {
  sub: number;
  role: string;
}

export interface RequestUser {
  id: number;
  role: string;
  permissions?: string[];
}

// Estrategia para requests posteriores al login: valida el Access Token
// (header Authorization: Bearer) y deja {id, role, permissions} en request.user.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      relations: {
        role: {
          permissions: true,
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesión inválida o usuario inactivo');
    }

    const permissions = user.role?.permissions?.map((p) => p.name) || [];

    return {
      id: user.id,
      role: user.role.name,
      permissions,
    };
  }
}
