import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { ActivationToken } from './entities/activation-token.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RoleEntity } from './entities/role.entity';
import { JwtPayload } from './strategies/jwt.strategy';
import { BCRYPT_COST } from './auth-password.config';
import { MailService } from './mail.service';
import { Role } from '../../common/enums/roles.enum';
import { Empleado } from '../empleados/entities/empleado.entity';
import { Abonado } from '../abonados/entities/abonado.entity';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { CloudinaryService } from '../../config/cloudinary.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    @InjectRepository(ActivationToken)
    private readonly activationTokenRepository: Repository<ActivationToken>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(Abonado)
    private readonly abonadoRepository: Repository<Abonado>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

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
    const payload: JwtPayload = { sub: user.id, role: user.role.name };
    const accessToken = this.jwtService.sign(payload);

    const refreshToken = randomBytes(64).toString('hex');
    await this.guardarRefreshToken(refreshToken, user.id);

    return { accessToken, refreshToken };
  }

  /**
   * Selector de perfil (ver Sidebar/DashboardHeader del frontend): re-emite
   * el access token con el rol del vínculo elegido, verificado acá (nunca
   * se confía en lo que mande el cliente). No toca el refresh token ni el
   * role_id real de la cuenta — es solo el rol "activo" de esta sesión, así
   * que /auth/refresh siempre vuelve a emitir con el rol base real (el
   * frontend debe volver a llamar este endpoint tras cada refresh si quiere
   * mantenerse en el perfil no-base).
   */
  async cambiarPerfilToken(
    usuarioId: number,
    perfil: 'base' | 'abonado' | 'empleado',
  ): Promise<{ accessToken: string }> {
    const user = await this.userRepository.findOne({
      where: { id: usuarioId },
      relations: { role: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesión inválida');
    }

    let rolActivo: string = user.role.name;

    if (perfil === 'abonado') {
      const abonado = await this.abonadoRepository.findOne({
        where: { usuario: { id: usuarioId } },
      });
      if (!abonado) {
        throw new BadRequestException('Esta cuenta no tiene un Abonado vinculado');
      }
      rolActivo = Role.ABONADO;
    } else if (perfil === 'empleado') {
      const empleado = await this.empleadoRepository.findOne({
        where: { usuario: { id: usuarioId } },
      });
      if (!empleado) {
        throw new BadRequestException('Esta cuenta no tiene un Empleado vinculado');
      }
      const rol = AuthService.rolParaPuesto(empleado.puesto);
      if (!rol) {
        throw new BadRequestException(
          `El puesto "${empleado.puesto}" del Empleado vinculado no tiene un rol asignado`,
        );
      }
      rolActivo = rol;
    }

    const payload: JwtPayload = { sub: user.id, role: rolActivo };
    return { accessToken: this.jwtService.sign(payload) };
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

  static hashRefreshToken(tokenPlano: string): string {
    return createHash('sha256').update(tokenPlano).digest('hex');
  }

  async refrescarSesion(
    tokenPlano: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    const fila = await this.refreshTokenRepository
      .createQueryBuilder('rt')
      .leftJoinAndSelect('rt.usuario', 'u')
      .leftJoinAndSelect('u.role', 'r')
      .where('rt.token_hash = :hash', {
        hash: AuthService.hashRefreshToken(tokenPlano),
      })
      .andWhere('rt.revoked_at IS NULL')
      .andWhere('rt.expires_at > NOW()')
      .getOne();

    if (!fila || !fila.usuario.isActive) {
      throw new UnauthorizedException('Sesión inválida');
    }

    await this.refreshTokenRepository.update(fila.id, {
      revoked_at: new Date(),
    });

    const nuevoRefreshToken = randomBytes(64).toString('hex');
    await this.guardarRefreshToken(nuevoRefreshToken, fila.usuario_id);

    const payload: JwtPayload = {
      sub: fila.usuario.id,
      role: fila.usuario.role.name,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: nuevoRefreshToken,
      user: fila.usuario,
    };
  }

  async obtenerPerfil(
    usuarioId: number,
  ): Promise<{ id: number; email: string; role: string }> {
    const user = await this.userRepository.findOne({
      where: { id: usuarioId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesión inválida');
    }

    return { id: user.id, email: user.email, role: user.role.name };
  }

  async revocarSesion(tokenPlano: string): Promise<void> {
    await this.refreshTokenRepository.update(
      {
        token_hash: AuthService.hashRefreshToken(tokenPlano),
        revoked_at: IsNull(),
      },
      { revoked_at: new Date() },
    );
  }

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

    user.password = await bcrypt.hash(nuevaPassword, BCRYPT_COST);
    await this.userRepository.save(user);

    await this.refreshTokenRepository.update(
      { usuario_id: usuarioId, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );

    return { mensaje: 'Contraseña actualizada. Inicia sesión nuevamente.' };
  }

  async solicitarResetPassword(email: string): Promise<{ mensaje: string }> {
    const MENSAJE_GENERICO = {
      mensaje:
        'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
    };

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || !user.isActive) {
      return MENSAJE_GENERICO;
    }

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
      console.error('Error al enviar correo de recuperación:', error);
      throw new InternalServerErrorException(
        'No se pudo enviar el correo de recuperación. Intenta más tarde.',
      );
    }

    return MENSAJE_GENERICO;
  }

  static hashResetToken(tokenPlano: string): string {
    return createHash('sha256').update(tokenPlano).digest('hex');
  }

  // Mismo mapeo que EmpleadosService.rolParaPuesto (privado ahí), pero sin
  // lanzar excepción: acá solo sirve para informar al selector de perfil
  // qué rol vería el usuario si cambia a su vínculo de Empleado, así que un
  // puesto sin mapear simplemente no ofrece esa opción (null).
  private static rolParaPuesto(puesto: string): Role | null {
    switch (puesto) {
      case 'Junta Directiva':
        return Role.SUPER_ADMIN;
      case 'Administrador':
        return Role.ADMIN;
      case 'Fontanero':
        return Role.FONTANERO;
      case 'Abonado':
        return Role.ABONADO;
      default:
        return null;
    }
  }

  async confirmarResetPassword(
    tokenPlano: string,
    nuevaPassword: string,
  ): Promise<{ mensaje: string }> {
    const fila = await this.passwordResetTokenRepository
      .createQueryBuilder('prt')
      .leftJoinAndSelect('prt.usuario', 'u')
      .where('prt.token_hash = :hash', {
        hash: AuthService.hashResetToken(tokenPlano),
      })
      .andWhere('prt.used_at IS NULL')
      .andWhere('prt.expires_at > NOW()')
      .getOne();

    if (!fila || !fila.usuario.isActive) {
      throw new BadRequestException(
        'El enlace de recuperación es inválido o ha expirado',
      );
    }

    fila.usuario.password = await bcrypt.hash(nuevaPassword, BCRYPT_COST);
    await this.userRepository.save(fila.usuario);

    await this.refreshTokenRepository.update(
      { usuario_id: fila.usuario_id, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );

    await this.passwordResetTokenRepository.update(fila.id, {
      used_at: new Date(),
    });

    return { mensaje: 'Contraseña actualizada. Inicia sesión nuevamente.' };
  }

  async registrar(
    email: string,
    password: string,
  ): Promise<{ mensaje: string }> {
    const existente = await this.userRepository.findOne({ where: { email } });
    if (existente) {
      throw new BadRequestException('Ya existe una cuenta con ese correo');
    }

    const rolAbonado = await this.roleRepository.findOne({
      where: { name: Role.ABONADO },
    });
    if (!rolAbonado) {
      throw new InternalServerErrorException(
        `No existe el rol '${Role.ABONADO}' en la tabla roles. Corré "npm run seed:roles".`,
      );
    }

    const user = this.userRepository.create({
      email,
      password: await bcrypt.hash(password, BCRYPT_COST),
      isActive: false,
      role: rolAbonado,
    });
    await this.userRepository.save(user);

    // Vincular automáticamente con un abonado existente que tenga el mismo
    // correo. Esto conecta la cuenta de acceso con el registro del abonado
    // en la tabla abonados, para que el perfil muestre sus datos.
    const abonado = await this.abonadoRepository.findOne({
      where: { correo: email },
    });
    if (abonado) {
      abonado.usuario = user;
      await this.abonadoRepository.save(abonado);
    }

    const tokenPlano = randomBytes(32).toString('hex');
    const horas = Number(
      this.configService.get<string>('ACCOUNT_ACTIVATION_EXPIRES_HOURS') ??
      24,
    );
    const expiresAt = new Date(Date.now() + horas * 60 * 60 * 1000);

    await this.activationTokenRepository.save(
      this.activationTokenRepository.create({
        token_hash: AuthService.hashActivationToken(tokenPlano),
        usuario_id: user.id,
        expires_at: expiresAt,
      }),
    );

    const url = `${this.configService.get<string>(
      'FRONTEND_URL',
    )}/activar-cuenta?token=${tokenPlano}`;

    try {
      await this.mailService.enviarCorreoBienvenida(user.email, url);
    } catch (error) {
      console.error('Error al enviar correo de bienvenida:', error);
    }

    return {
      mensaje:
        'Cuenta creada. Revisa tu correo para activarla antes de iniciar sesión.',
    };
  }

  static hashActivationToken(tokenPlano: string): string {
    return createHash('sha256').update(tokenPlano).digest('hex');
  }

  async verificarEmail(tokenPlano: string): Promise<{ mensaje: string }> {
    const fila = await this.activationTokenRepository
      .createQueryBuilder('at')
      .leftJoinAndSelect('at.usuario', 'u')
      .where('at.token_hash = :hash', {
        hash: AuthService.hashActivationToken(tokenPlano),
      })
      .andWhere('at.used_at IS NULL')
      .andWhere('at.expires_at > NOW()')
      .getOne();

    if (!fila) {
      throw new BadRequestException(
        'El enlace de activación es inválido o ha expirado',
      );
    }

    await this.userRepository.update(fila.usuario_id, { isActive: true });
    await this.activationTokenRepository.update(fila.id, {
      used_at: new Date(),
    });

    return {
      mensaje: 'Cuenta activada correctamente. Ya puedes iniciar sesión.',
    };
  }


  async listarUsuarios(): Promise<
    Array<{
      id: number;
      email: string;
      username: string | null;
      role: string;
      role_id: number;
      isActive: boolean;
      createdAt: Date;
      vinculos: Array<{
        tipo: 'Abonado' | 'Empleado';
        id: number;
        nombre: string;
        cedula: string;
      }>;
    }>
  > {
    const usuarios = await this.userRepository.find({
      relations: { role: true },
      order: { id: 'ASC' },
    });

    // La vista de Usuarios necesita mostrar a qué Abonado o Empleado
    // pertenece cada cuenta (si a alguno) — hoy quedaba invisible porque la
    // FK vive del otro lado (Abonado.usuario_id / Empleado.usuario_id), no
    // en User. Se resuelve con dos consultas en bloque (no una por
    // usuario) y se arman mapas usuario_id -> registro.
    const [abonados, empleados] = await Promise.all([
      this.abonadoRepository.find({ relations: { usuario: true } }),
      this.empleadoRepository.find({ relations: { usuario: true } }),
    ]);
    const abonadoPorUsuarioId = new Map(
      abonados.filter((a) => a.usuario).map((a) => [a.usuario!.id, a]),
    );
    const empleadoPorUsuarioId = new Map(
      empleados.filter((e) => e.usuario).map((e) => [e.usuario!.id, e]),
    );

    return usuarios.map((u) => {
      const abonado = abonadoPorUsuarioId.get(u.id);
      const empleado = empleadoPorUsuarioId.get(u.id);

      // Una misma cuenta puede estar ligada a un Empleado Y a un Abonado a
      // la vez (misma persona en ambos roles), así que se listan TODOS los
      // vínculos en lugar de elegir el primero que aparezca.
      const vinculos: Array<{
        tipo: 'Abonado' | 'Empleado';
        id: number;
        nombre: string;
        cedula: string;
      }> = [];
      if (abonado) {
        vinculos.push({
          tipo: 'Abonado',
          id: abonado.id,
          nombre: abonado.nombre,
          cedula: abonado.cedula,
        });
      }
      if (empleado) {
        vinculos.push({
          tipo: 'Empleado',
          id: empleado.id,
          nombre: empleado.nombre,
          cedula: empleado.cedula,
        });
      }

      return {
        id: u.id,
        email: u.email,
        username: u.username,
        role: u.role?.name ?? 'Sin rol',
        role_id: u.role?.id,
        isActive: u.isActive,
        createdAt: u.createdAt,
        vinculos,
      };
    });
  }

  // Activar o Inhabilitar usuario y revocar sesiones activas si se desactiva.
  // solicitanteId es el id de la cuenta que hace la petición (req.user.id):
  // nadie puede inhabilitarse a sí mismo, para no quedarse sin forma de
  // volver a activarse (perdería sus propias credenciales de acceso).
  async cambiarEstadoUsuario(
    usuarioId: number,
    isActive: boolean,
    solicitanteId?: number,
  ): Promise<{
    id: number;
    email: string;
    role: string;
    role_id: number;
    isActive: boolean;
    createdAt: Date;
  }> {
    if (!isActive && solicitanteId === usuarioId) {
      throw new BadRequestException(
        'No podés inhabilitar tu propia cuenta. Pedile a otro administrador que lo haga.',
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: usuarioId },
      relations: { role: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    user.isActive = isActive;
    await this.userRepository.save(user);

    if (!isActive) {
      await this.refreshTokenRepository.update(
        { usuario_id: usuarioId, revoked_at: IsNull() },
        { revoked_at: new Date() },
      );
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role?.name ?? 'Sin rol',
      role_id: user.role?.id,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  // Cambiar el rol asignado a un usuario
  async cambiarRolUsuario(
    usuarioId: number,
    roleId: number,
  ): Promise<{
    id: number;
    email: string;
    role: string;
    role_id: number;
    isActive: boolean;
    createdAt: Date;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: usuarioId },
      relations: { role: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const nuevoRol = await this.roleRepository.findOne({
      where: { id: roleId },
    });

    if (!nuevoRol) {
      throw new NotFoundException('El rol especificado no existe');
    }

    user.role = nuevoRol;
    await this.userRepository.save(user);

    return {
      id: user.id,
      email: user.email,
      role: user.role?.name ?? 'Sin rol',
      role_id: user.role?.id,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async crearUsuarioPorAdmin(
    email: string,
    passwordPlano: string,
    roleId: number,
  ): Promise<{
    id: number;
    email: string;
    role: string;
    isActive: boolean;
    asociacion: 'abonado' | 'empleado' | null;
  }> {
    const existe = await this.userRepository.findOne({ where: { email } });
    if (existe) {
      throw new BadRequestException('Ya existe una cuenta con ese correo electrónico');
    }

    const rol = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!rol) {
      throw new BadRequestException('El rol seleccionado no existe en el sistema');
    }

    const passwordHash = await bcrypt.hash(passwordPlano, BCRYPT_COST);

    const nuevoUsuario = this.userRepository.create({
      email,
      password: passwordHash,
      role: rol,
      isActive: true, // Creado por admin nace activo directamente
    });

    const guardado = await this.userRepository.save(nuevoUsuario);

    // Vincular automáticamente con un abonado o empleado que tenga el
    // mismo correo (y que aún no tenga cuenta asociada). Prioridad:
    // primero el abonado, luego el empleado.
    let asociacion: 'abonado' | 'empleado' | null = null;
    const abonado = await this.abonadoRepository.findOne({
      where: { correo: email, usuario: IsNull() },
    });
    if (abonado) {
      abonado.usuario = guardado;
      await this.abonadoRepository.save(abonado);
      asociacion = 'abonado';
    } else {
      const empleado = await this.empleadoRepository.findOne({
        where: { correo: email, usuario: IsNull() },
      });
      if (empleado) {
        empleado.usuario = guardado;
        await this.empleadoRepository.save(empleado);
        asociacion = 'empleado';
      }
    }

    return {
      id: guardado.id,
      email: guardado.email,
      role: guardado.role.name,
      isActive: guardado.isActive,
      asociacion,
    };
  }

  /**
   * Crea (o vincula) la cuenta de acceso de un Abonado recién registrado
   * por un administrador — ver AbonadosService.create(). Se llama
   * automáticamente al dar de alta el abonado, sin que el admin tenga que
   * ir aparte al módulo de Usuarios a inventarle una contraseña.
   *
   * - Si ya existe una cuenta con ese correo (ej. la persona ya tenía
   *   acceso como Empleado/Junta), solo se vincula: no se toca su
   *   contraseña ni se le manda correo, para no interferir con una cuenta
   *   que ya usa.
   * - Si no existe, se crea una cuenta activa con una contraseña aleatoria
   *   que nadie conoce (la persona nunca la necesita), y se le manda un
   *   correo con un enlace que usa el mismo mecanismo de "recuperar
   *   contraseña" (password_reset_tokens + /restablecer-password) para que
   *   defina la suya. El sistema no distingue entre poner una contraseña
   *   por primera vez o cambiar una que ya existía, así que no hace falta
   *   un flujo aparte.
   */
  async crearCuentaParaAbonado(abonado: Abonado): Promise<void> {
    const existente = await this.userRepository.findOne({
      where: { email: abonado.correo },
    });

    if (existente) {
      abonado.usuario = existente;
      await this.abonadoRepository.save(abonado);
      return;
    }

    const rolAbonado = await this.roleRepository.findOne({
      where: { name: Role.ABONADO },
    });
    if (!rolAbonado) {
      // No debería pasar en un ambiente ya sembrado ("npm run seed:roles"),
      // pero si pasa no debe tumbar el alta del abonado — solo se registra
      // el error, y la cuenta se puede crear después a mano desde Usuarios.
      console.error(
        `No existe el rol '${Role.ABONADO}' en la tabla roles: no se pudo crear la cuenta de acceso del abonado ${abonado.id}.`,
      );
      return;
    }

    // Contraseña aleatoria que nadie llega a usar: la persona define la
    // suya con el enlace del correo antes de poder iniciar sesión.
    const passwordAleatoria = randomBytes(32).toString('hex');
    const nuevoUsuario = this.userRepository.create({
      email: abonado.correo,
      password: await bcrypt.hash(passwordAleatoria, BCRYPT_COST),
      role: rolAbonado,
      isActive: true,
    });
    const usuarioGuardado = await this.userRepository.save(nuevoUsuario);

    abonado.usuario = usuarioGuardado;
    await this.abonadoRepository.save(abonado);

    const tokenPlano = randomBytes(32).toString('hex');
    // Mismo horizonte que el correo de bienvenida/activación (24h por
    // defecto): es un correo de "primer acceso", tiene sentido darle más
    // margen que a un reset de contraseña normal (30 min).
    const horas = Number(
      this.configService.get<string>('ACCOUNT_ACTIVATION_EXPIRES_HOURS') ??
      24,
    );
    const expiresAt = new Date(Date.now() + horas * 60 * 60 * 1000);

    await this.passwordResetTokenRepository.save(
      this.passwordResetTokenRepository.create({
        token_hash: AuthService.hashResetToken(tokenPlano),
        usuario_id: usuarioGuardado.id,
        expires_at: expiresAt,
      }),
    );

    const url = `${this.configService.get<string>(
      'FRONTEND_URL',
    )}/restablecer-password?token=${tokenPlano}`;

    try {
      await this.mailService.enviarCorreoAccesoAbonado(
        usuarioGuardado.email,
        url,
      );
    } catch (error) {
      // La cuenta y el vínculo ya quedaron guardados aunque el correo
      // falle; se puede reenviar el acceso después desde Usuarios.
      console.error(
        `Error al enviar el correo de acceso al abonado ${abonado.id}:`,
        error,
      );
    }
  }

  /**
   * Crear la cuenta de acceso de un Empleado vinculado recién, con el rol
   * que corresponda a su puesto (ver rolParaPuesto en EmpleadosService).
   * Replica el mecanismo de crearCuentaParaAbonado: si ya existe un usuario
   * con ese correo solo lo enlaza, y si no existe crea una cuenta activa con
   * contraseña aleatoria (nadie la usa) y envía un correo de "primer acceso"
   * que reutiliza el flujo de /restablecer-password.
   */
  async crearCuentaParaEmpleado(
    empleado: Empleado,
    rol: Role,
  ): Promise<void> {
    const existente = await this.userRepository.findOne({
      where: { email: empleado.correo },
    });

    if (existente) {
      empleado.usuario = existente;
      await this.empleadoRepository.save(empleado);
      return;
    }

    const rolEntity = await this.roleRepository.findOne({
      where: { name: rol },
    });
    if (!rolEntity) {
      // No debería pasar en un ambiente sembrado ("npm run seed:roles"),
      // pero si pasa no debe tumbar la vinculación del empleado — solo se
      // registra el error y la cuenta se crea después a mano desde Usuarios.
      console.error(
        `No existe el rol '${rol}' en la tabla roles: no se pudo crear la cuenta de acceso del empleado ${empleado.id}.`,
      );
      return;
    }

    // Contraseña aleatoria que nadie llega a usar: la persona define la
    // suya con el enlace del correo antes de poder iniciar sesión.
    const passwordAleatoria = randomBytes(32).toString('hex');
    const nuevoUsuario = this.userRepository.create({
      email: empleado.correo,
      password: await bcrypt.hash(passwordAleatoria, BCRYPT_COST),
      role: rolEntity,
      isActive: true,
    });
    const usuarioGuardado = await this.userRepository.save(nuevoUsuario);

    empleado.usuario = usuarioGuardado;
    await this.empleadoRepository.save(empleado);

    const tokenPlano = randomBytes(32).toString('hex');
    const horas = Number(
      this.configService.get<string>('ACCOUNT_ACTIVATION_EXPIRES_HOURS') ??
        24,
    );
    const expiresAt = new Date(Date.now() + horas * 60 * 60 * 1000);

    await this.passwordResetTokenRepository.save(
      this.passwordResetTokenRepository.create({
        token_hash: AuthService.hashResetToken(tokenPlano),
        usuario_id: usuarioGuardado.id,
        expires_at: expiresAt,
      }),
    );

    const url = `${this.configService.get<string>(
      'FRONTEND_URL',
    )}/restablecer-password?token=${tokenPlano}`;

    try {
      await this.mailService.enviarCorreoAccesoAbonado(
        usuarioGuardado.email,
        url,
      );
    } catch (error) {
      // La cuenta y el vínculo ya quedaron guardados aunque el correo
      // falle; se puede reenviar el acceso después desde Usuarios.
      console.error(
        `Error al enviar el correo de acceso al empleado ${empleado.id}:`,
        error,
      );
    }
  }

  // ── Perfil del usuario ────────────────────────────────────────────

  /**
   * Retorna el perfil completo del usuario: datos de la tabla usuarios
   * más los datos del empleado o abonado asociado (nombre, cédula, etc.).
   */
  async obtenerPerfilCompleto(usuarioId: number) {
    const user = await this.userRepository.findOne({
      where: { id: usuarioId },
      relations: { role: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesión inválida');
    }

    // Se buscan AMBOS vínculos, no solo el primero que aparezca: una misma
    // cuenta puede estar ligada a un Empleado (ej. Junta Directiva) Y a un
    // Abonado a la vez (ver la confirmación explícita en
    // AbonadosService.create / EmpleadosService.crear). El selector de
    // perfil del frontend usa 'vinculos' para saber si mostrar la opción de
    // "ver como Abonado"; los campos planos (nombre, cedula, etc.) siguen
    // priorizando empleado por compatibilidad con lo que ya consumía
    // Perfil.tsx antes de este cambio.
    const [empleado, abonado] = await Promise.all([
      this.empleadoRepository.findOne({ where: { usuario: { id: usuarioId } } }),
      this.abonadoRepository.findOne({ where: { usuario: { id: usuarioId } } }),
    ]);

    const vinculos = {
      empleado: empleado
        ? {
            id: empleado.id,
            nombre: empleado.nombre,
            puesto: empleado.puesto,
            // Rol que le correspondería si se viera con este perfil (ver
            // selector de perfil del Sidebar) — null si el puesto no está
            // mapeado a un rol (mismo criterio que EmpleadosService al
            // crear la cuenta de acceso, solo que sin lanzar error acá).
            rol: AuthService.rolParaPuesto(empleado.puesto),
          }
        : null,
      abonado: abonado
        ? { id: abonado.id, nombre: abonado.nombre, numero_abonado: abonado.numero_abonado }
        : null,
    };

    if (empleado) {
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role.name,
        foto_url: user.foto_url,
        nombre: empleado.nombre,
        apellido1: empleado.apellido1,
        apellido2: empleado.apellido2,
        cedula: empleado.cedula,
        telefono: empleado.telefono,
        puesto: empleado.puesto,
        tipo_asociacion: 'empleado' as const,
        vinculos,
      };
    }

    if (abonado) {
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role.name,
        foto_url: user.foto_url,
        nombre: abonado.nombre,
        apellido1: null,
        apellido2: null,
        cedula: abonado.cedula,
        telefono: abonado.telefono,
        direccion: abonado.direccion,
        puesto: null,
        tipo_asociacion: 'abonado' as const,
        vinculos,
      };
    }

    // Sin asociación (no debería pasar, pero se maneja)
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role.name,
      foto_url: user.foto_url,
      nombre: null,
      apellido1: null,
      apellido2: null,
      cedula: null,
      telefono: null,
      puesto: null,
      tipo_asociacion: null as string | null,
      vinculos,
    };
  }

  /**
   * Actualiza los campos editables del perfil (email y teléfono).
   * Si se cambia el email, se debe verificar la nueva cuenta.
   */
  async actualizarPerfil(
    usuarioId: number,
    dto: ActualizarPerfilDto,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: usuarioId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesión inválida');
    }

    // Actualizar teléfono en la tabla asociada (empleado o abonado)
    if (dto.telefono !== undefined) {
      const empleado = await this.empleadoRepository.findOne({
        where: { usuario: { id: usuarioId } },
      });
      if (empleado) {
        empleado.telefono = dto.telefono;
        await this.empleadoRepository.save(empleado);
      } else {
        const abonado = await this.abonadoRepository.findOne({
          where: { usuario: { id: usuarioId } },
        });
        if (abonado) {
          abonado.telefono = dto.telefono;
          await this.abonadoRepository.save(abonado);
        }
      }
    }

    // Actualizar email si se proporciona y es diferente
    if (dto.email && dto.email !== user.email) {
      const existe = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (existe) {
        throw new BadRequestException('Ya existe una cuenta con ese correo');
      }

      user.email = dto.email;
      await this.userRepository.save(user);
    }

    // Nombre de usuario para mostrar (reemplaza el derivado del correo en
    // el sidebar/header/lista de Usuarios una vez que se define).
    if (dto.username && dto.username !== user.username) {
      const existe = await this.userRepository.findOne({
        where: { username: dto.username },
      });
      if (existe) {
        throw new BadRequestException('Ese nombre de usuario ya está en uso');
      }

      user.username = dto.username;
      await this.userRepository.save(user);
    }

    return this.obtenerPerfilCompleto(usuarioId);
  }

  /**
   * Guarda la foto de perfil del usuario en Cloudinary.
   * Elimina la anterior de la nube si existe, para no acumular archivos
   * huérfanos (la foto vieja ya no se necesita: no hay historial de fotos).
   */
  async subirFoto(
    usuarioId: number,
    file: Express.Multer.File,
  ): Promise<{ foto_url: string }> {
    const user = await this.userRepository.findOne({
      where: { id: usuarioId },
    });
 
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
 
    // Guardamos el public_id anterior antes de sobrescribirlo, para poder
    // borrar esa foto de Cloudinary una vez que la nueva se haya subido bien.
    const publicIdAnterior = user.foto_public_id;
 
    // Subir la nueva foto
    const fotoSubida = await this.cloudinaryService.subirArchivo(
      file,
      'ASADA/usuarios',
    );
 
    user.foto_url = fotoSubida.url;
    user.foto_public_id = fotoSubida.publicId;
    await this.userRepository.save(user);
 
    // Recién ahora se borra la anterior: si algo falla arriba, el usuario
    // conserva su foto vieja en vez de quedarse sin ninguna.
    if (publicIdAnterior) {
      await this.cloudinaryService.eliminarArchivo(publicIdAnterior, true);
    }
 
    return { foto_url: user.foto_url };
  }
}