import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { JwtPayload } from './strategies/jwt.strategy';
import { BCRYPT_COST } from './auth-password.config';
import { MailService } from './mail.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  // Devuelve el usuario solo si existe, está activo y la contraseña coincide.
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || !user.isActive) {
      return null;
    }

    const coincide = await bcrypt.compare(password, user.password);
    if (!coincide) {
      return null;
    }

    return user;
  }

  // Genera el par de tokens para una sesión nueva.
  async login(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Access Token de corta duración con el payload que consumen los guards.
    const payload: JwtPayload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    // Refresh Token opaco (aleatorio): viaja en cookie httpOnly y en BD va hasheado.
    const refreshToken = randomBytes(64).toString('hex');
    await this.guardarRefreshToken(refreshToken, user.id);

    return { accessToken, refreshToken };
  }

  private async guardarRefreshToken(
    tokenPlano: string,
    usuarioId: number,
  ): Promise<void> {
    const dias = Number(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_DAYS') ?? 7,
    );
    const expiresAt = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        token_hash: AuthService.hashRefreshToken(tokenPlano),
        usuario_id: usuarioId,
        expires_at: expiresAt,
      }),
    );
  }

  // SHA-256 en hexadecimal; también lo usará el endpoint /refresh para buscarlo.
  static hashRefreshToken(tokenPlano: string): string {
    return createHash('sha256').update(tokenPlano).digest('hex');
  }

  // Valida el Refresh Token contra la BD y emite un nuevo par de tokens
  // (rotación: cada refresh token solo puede usarse una vez). El mensaje de
  // error es genérico para no revelar qué validación exacta falló.
  //
  // Las condiciones de vigencia se evalúan EN SQL (expires_at > NOW()):
  // MySQL compara TIMESTAMP en tiempo absoluto, inmune al desfase de zona
  // horaria que puede introducir la conversión fecha JS <-> driver.
  async refrescarSesion(
    tokenPlano: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    const fila = await this.refreshTokenRepository
      .createQueryBuilder('rt')
      .leftJoinAndSelect('rt.usuario', 'u')
      .where('rt.token_hash = :hash', {
        hash: AuthService.hashRefreshToken(tokenPlano),
      })
      .andWhere('rt.revoked_at IS NULL')
      .andWhere('rt.expires_at > NOW()')
      .getOne();

    if (!fila || !fila.usuario.isActive) {
      throw new UnauthorizedException('Sesión inválida');
    }

    // Rotación: el token usado queda revocado y nace uno nuevo en su lugar.
    // Un token filtrado pierde todo valor en cuanto se utiliza.
    await this.refreshTokenRepository.update(fila.id, {
      revoked_at: new Date(),
    });

    const nuevoRefreshToken = randomBytes(64).toString('hex');
    await this.guardarRefreshToken(nuevoRefreshToken, fila.usuario_id);

    const payload: JwtPayload = {
      sub: fila.usuario.id,
      role: fila.usuario.role,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: nuevoRefreshToken,
      user: fila.usuario,
    };
  }

  // Datos del usuario autenticado para GET /auth/perfil. Revalida contra la BD:
  // un usuario desactivado pierde el acceso aunque su Access Token no haya
  // expirado todavía.
  async obtenerPerfil(
    usuarioId: number,
  ): Promise<Pick<User, 'id' | 'email' | 'role'>> {
    const user = await this.userRepository.findOne({
      where: { id: usuarioId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesión inválida');
    }

    return { id: user.id, email: user.email, role: user.role };
  }

  // Cierra la sesión revocando el Refresh Token (logout). Revocación suave
  // (revoked_at) para dejar rastro auditable y por consistencia con la
  // rotación de /refresh. Es idempotente: revocar un token inexistente o ya
  // revocado no produce error.
  async revocarSesion(tokenPlano: string): Promise<void> {
    await this.refreshTokenRepository.update(
      {
        token_hash: AuthService.hashRefreshToken(tokenPlano),
        revoked_at: IsNull(),
      },
      { revoked_at: new Date() },
    );
  }

  // Cambia la contraseña del usuario autenticado. Verifica la contraseña
  // actual con la comparación segura de bcrypt (nunca comparamos texto
  // plano), guarda la nueva hasheada con BCRYPT_COST y revoca TODOS los
  // Refresh Tokens vigentes del usuario: cambiar contraseña invalida toda
  // sesión activa (este dispositivo incluido) y obliga a iniciar sesión de
  // nuevo con la contraseña nueva.
  async cambiarPassword(
    usuarioId: number,
    passwordActual: string,
    nuevaPassword: string,
  ): Promise<{ mensaje: string }> {
    const user = await this.userRepository.findOne({
      where: { id: usuarioId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesión inválida');
    }

    const coincide = await bcrypt.compare(passwordActual, user.password);
    if (!coincide) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    if (nuevaPassword === passwordActual) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente a la actual',
      );
    }

    // Las reglas de fortaleza viven en CambiarPasswordDto (class-validator);
    // aquí solo confiamos en que ya pasaron y aplicamos el hash.
    user.password = await bcrypt.hash(nuevaPassword, BCRYPT_COST);
    await this.userRepository.save(user);

    // Revocación masiva: mismo patrón suave de revocarSesion, pero filtrado
    // por usuario para cubrir todas sus sesiones abiertas.
    await this.refreshTokenRepository.update(
      { usuario_id: usuarioId, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );

    return { mensaje: 'Contraseña actualizada. Inicia sesión nuevamente.' };
  }

  // Genera y envía un token de recuperación de contraseña para el correo
  // indicado. Nunca revela si el correo existe: siempre responde el mismo
  // mensaje genérico, tanto si el usuario existe como si no, para no
  // permitir enumerar cuentas registradas por la respuesta.
  async solicitarResetPassword(email: string): Promise<{ mensaje: string }> {
    const MENSAJE_GENERICO = {
      mensaje:
        'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
    };
 
    const user = await this.userRepository.findOne({ where: { email } });
 
    // No revelar existencia del correo: se sale aquí con el mismo mensaje,
    // sin distinguir "no existe" de "sí existe pero algo falló después".
    if (!user || !user.isActive) {
      return MENSAJE_GENERICO;
    }
 
    // Invalida cualquier token de recuperación previo sin usar: solo el
    // último enlace enviado debe quedar vigente.
    await this.passwordResetTokenRepository.delete({
      usuario_id: user.id,
      used_at: IsNull(),
    });
 
    const tokenPlano = randomBytes(32).toString('hex');
    const minutos = Number(
      this.configService.get<string>('PASSWORD_RESET_EXPIRES_MINUTES') ?? 30,
    );
    const expiresAt = new Date(Date.now() + minutos * 60 * 1000);
 
    await this.passwordResetTokenRepository.save(
      this.passwordResetTokenRepository.create({
        token_hash: AuthService.hashResetToken(tokenPlano),
        usuario_id: user.id,
        expires_at: expiresAt,
      }),
    );
 
    const url = `${this.configService.get<string>(
      'FRONTEND_URL',
    )}/restablecer-password?token=${tokenPlano}`;
 
    try {
      await this.mailService.enviarCorreoResetPassword(user.email, url);
    } catch (error) {
      // Fallo controlado: se registra para diagnóstico, pero no se revela
      // el detalle al cliente (podría filtrar info de la infraestructura
      // de correo). El mensaje SÍ puede ser distinto aquí porque el fallo
      // es nuestro (SMTP caído), no depende de si el correo existe o no.
      console.error('Error al enviar correo de recuperación:', error);
      throw new InternalServerErrorException(
        'No se pudo enviar el correo de recuperación. Intenta más tarde.',
      );
    }
 
    return MENSAJE_GENERICO;
  }
 
  // SHA-256 en hexadecimal; el futuro endpoint de confirmación lo usará
  // para volver a calcular el hash del token recibido y compararlo.
  static hashResetToken(tokenPlano: string): string {
    return createHash('sha256').update(tokenPlano).digest('hex');
  }
}
