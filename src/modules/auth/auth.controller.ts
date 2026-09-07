import {
  Controller,
  Post,
  Get,
  Patch,
  Query,
  Req,
  Res,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UnauthorizedException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {POLITICA_LOGIN_THROTTLE,POLITICA_RESET_THROTTLE,POLITICA_REGISTRO_THROTTLE,} from './auth-throttle.config';
import { User } from './entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { SolicitarResetPasswordDto } from './dto/solicitar-reset-password.dto';
import { ConfirmarResetPasswordDto } from './dto/confirmar-reset-password.dto';
import { RegistroDto } from './dto/registro.dto';
import { VerificarEmailDto } from './dto/verificar-email.dto';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { LocalAuthGuard } from '../../common/guards/local-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Nombre de la cookie del Refresh Token; lo reutilizarán /refresh y /logout.
export const REFRESH_COOKIE = 'refresh_token';

// Límite y formatos permitidos para la foto de perfil (PATCH /auth/foto).
// 2 MB es holgado para una foto de perfil y queda muy por debajo del
// máximo de 10 MB por imagen del plan gratuito de Cloudinary.
const FOTO_MAX_FILE_SIZE = 2 * 1024 * 1024;
const FOTO_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // Cookie del Refresh Token: inaccesible desde JS, solo viaja a /auth/*.
  private emitirCookieRefresh(res: Response, refreshToken: string): void {
    const dias = Number(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_DAYS') ?? 7,
    );
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge: dias * 24 * 60 * 60 * 1000,
    });
  }

  // POST /auth/registro
  // Ruta pública. Crea la cuenta en estado "pendiente" (isActive: false) y
  // dispara el correo de bienvenida con el enlace de activación. Mismo
  // límite conservador que reset-password para evitar registro masivo
  // automatizado.
  @UseGuards(ThrottlerGuard)
  @Throttle(POLITICA_REGISTRO_THROTTLE)
  @Post('registro')
  @HttpCode(HttpStatus.CREATED)
  async registro(@Body() dto: RegistroDto): Promise<{ mensaje: string }> {
    return this.authService.registrar(dto.email, dto.password);
  }

  // GET /auth/verify-email?token=...
  // Ruta pública. Valida el token de activación recibido en la URL del
  // correo de bienvenida y pasa la cuenta de "pendiente" a "activa".
  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Query() dto: VerificarEmailDto,
  ): Promise<{ mensaje: string }> {
    return this.authService.verificarEmail(dto.token);
  }

  // POST /auth/login
  // ThrottlerGuard corre ANTES que LocalAuthGuard: las peticiones que excedan
  // el límite (5 por IP cada 15 min) reciben 429 sin siquiera intentar el
  // bcrypt, blindando el endpoint contra fuerza bruta. LocalAuthGuard valida
  // las credenciales (local.strategy.ts) y deja el usuario en request.user.
  // Emite Access Token en el cuerpo y el Refresh Token en una cookie httpOnly
  // que nunca queda expuesta al JS del cliente.
  @UseGuards(ThrottlerGuard, LocalAuthGuard)
  @Throttle(POLITICA_LOGIN_THROTTLE)
  @Post('login')
  async login(
    // El DTO documenta el contrato y activa la validación global del body.
    // La validación de formato efectiva ocurre en local.strategy.ts (ver nota ahí).
    @Body() _loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: { id: number; email: string; role: string } }> {
    const user = req.user as User;
    const { accessToken, refreshToken } = await this.authService.login(user);
    this.emitirCookieRefresh(res, refreshToken);

    return {
      accessToken,
      user: { id: user.id, email: user.email, role: user.role.name },
    };
  }

  // POST /auth/reset-password/solicitar
  // Ruta pública: cualquiera puede solicitarlo con solo un correo. Igual
  // que login, se limita por IP (ver POLITICA_RESET_THROTTLE) para evitar
  // spam de correos y enumeración de cuentas por tiempos de respuesta.
  @UseGuards(ThrottlerGuard)
  @Throttle(POLITICA_RESET_THROTTLE)
  @Post('reset-password/solicitar')
  @HttpCode(HttpStatus.OK)
  async solicitarResetPassword(
    @Body() dto: SolicitarResetPasswordDto,
  ): Promise<{ mensaje: string }> {
    return this.authService.solicitarResetPassword(dto.email);
  }

  // POST /auth/reset-password/confirmar
  // Ruta pública: recibe el token del correo + la nueva contraseña, valida
  // el hash contra la BD (vigente, no usado) y revoca todas las sesiones
  // activas del usuario al completar el cambio. Mismo límite por IP que
  // /solicitar para no facilitar fuerza bruta sobre el token.
  @UseGuards(ThrottlerGuard)
  @Throttle(POLITICA_RESET_THROTTLE)
  @Post('reset-password/confirmar')
  @HttpCode(HttpStatus.OK)
  async confirmarResetPassword(
    @Body() dto: ConfirmarResetPasswordDto,
  ): Promise<{ mensaje: string }> {
    return this.authService.confirmarResetPassword(
      dto.token,
      dto.nuevaPassword,
    );
  }

  // POST /auth/refresh
  // Lee el Refresh Token de la cookie httpOnly, lo valida contra la BD
  // (exista, vigente, no revocado, usuario activo) y rota el par: revoca el
  // usado, emite uno nuevo en la cookie y responde con un Access Token nuevo.
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: { id: number; email: string; role: string } }> {
    const tokenPlano = req.cookies?.[REFRESH_COOKIE];
    if (!tokenPlano) {
      throw new UnauthorizedException('Sesión inválida');
    }

    const { accessToken, refreshToken, user } =
      await this.authService.refrescarSesion(tokenPlano);
    this.emitirCookieRefresh(res, refreshToken);

    return {
      accessToken,
      user: { id: user.id, email: user.email, role: user.role.name },
    };
  }

  // GET /auth/perfil
  // Retorna el perfil completo del usuario: datos de la tabla usuarios
  // más los datos del empleado o abonado asociado (nombre, cédula, etc.).
  @UseGuards(JwtAuthGuard)
  @Get('perfil')
  async perfil(@Req() req: Request) {
    const { id } = req.user as { id: number };
    return this.authService.obtenerPerfilCompleto(id);
  }

  // PATCH /auth/perfil
  // Actualiza los campos editables del perfil (email y teléfono).
  @UseGuards(JwtAuthGuard)
  @Patch('perfil')
  async actualizarPerfil(
    @Req() req: Request,
    @Body() dto: ActualizarPerfilDto,
  ) {
    const { id } = req.user as { id: number };
    return this.authService.actualizarPerfil(id, dto);
  }

  // PATCH /auth/foto
  // Sube una foto de perfil (multipart/form-data, campo "foto"). Se recibe
  // en memoria y el service la sube a Cloudinary (ver auth.service.ts,
  // subirFoto) — ya no se guarda nada en uploads/usuarios/ del servidor.
  @UseGuards(JwtAuthGuard)
  @Patch('foto')
  @UseInterceptors(
    FileInterceptor('foto', {
      storage: memoryStorage(),
      limits: { fileSize: FOTO_MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!FOTO_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          // BadRequestException (400), no UnauthorizedException (401): el
          // usuario sí está autenticado, lo que está mal es el archivo que
          // mandó, no su sesión.
          cb(
            new BadRequestException(
              'Solo se permiten imágenes (JPG, PNG, GIF, WEBP)',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async subirFoto(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Revalidación explícita de tamaño (limits.fileSize de multer no
    // siempre produce un mensaje claro) — mismo criterio que en
    // documentos.controller.ts y solicitudes.controller.ts.
    if (file && file.size > FOTO_MAX_FILE_SIZE) {
      throw new BadRequestException('La foto no puede superar los 2 MB');
    }

    const { id } = req.user as { id: number };
    return this.authService.subirFoto(id, file);
  }

  // POST /auth/cambiar-password
  // Usuario autenticado cambia su propia contraseña. El body pasa por el
  // ValidationPipe global con las reglas de fortaleza de CambiarPasswordDto;
  // al guardar el nuevo hash se revocan todas las sesiones activas del
  // usuario, así que la respuesta invita a iniciar sesión de nuevo.
  @UseGuards(JwtAuthGuard)
  @Post('cambiar-password')
  @HttpCode(HttpStatus.OK)
  async cambiarPassword(
    @Req() req: Request,
    @Body() dto: CambiarPasswordDto,
  ): Promise<{ mensaje: string }> {
    const { id } = req.user as { id: number };
    return this.authService.cambiarPassword(
      id,
      dto.passwordActual,
      dto.nuevaPassword,
    );
  }

  // POST /auth/logout
  // Cierra la sesión del Refresh Token que trae la cookie httpOnly: lo marca
  // revocado en la BD y ordena al navegador borrar la cookie. No exige Access
  // Token vigente: poseer la cookie autoriza destruirla (funciona incluso con
  // el token de acceso ya expirado). Idempotente: sin cookie o con token ya
  // revocado responde igual; nunca revela si había una sesión válida.
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ mensaje: string }> {
    const tokenPlano = req.cookies?.[REFRESH_COOKIE];
    if (tokenPlano) {
      await this.authService.revocarSesion(tokenPlano);
    }

    // Mismos flags que emitirCookieRefresh: para borrar una cookie el
    // navegador debe recibir nombre + path idénticos a los de su creación.
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/auth',
    });

    return { mensaje: 'Sesión cerrada' };
  }
}