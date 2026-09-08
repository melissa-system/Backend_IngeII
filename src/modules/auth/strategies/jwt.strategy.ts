import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { RoleEntity } from '../entities/role.entity';

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
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
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
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesión inválida o usuario inactivo');
    }

    // El rol se resuelve del payload del token (payload.role), NO de
    // user.role: AuthService.cambiarPerfilToken() emite un access token con
    // un rol distinto al real de la cuenta cuando la persona usa el
    // selector de perfil (ej. Abonado con un Empleado vinculado "viendo
    // como" ese Empleado). Como el token viene firmado por el propio
    // backend, confiar en payload.role es seguro — nadie más puede
    // producir una firma válida — y es justo el propósito de llevar el rol
    // en el JWT en vez de volver a resolverlo siempre desde user.role.
    const role = await this.roleRepository.findOne({
      where: { name: payload.role },
      relations: { permissions: true },
    });

    if (!role) {
      throw new UnauthorizedException('Rol inválido en la sesión');
    }

    const permissions = role.permissions?.map((p) => p.name) || [];

    return {
      id: user.id,
      role: role.name,
      permissions,
    };
  }
}
