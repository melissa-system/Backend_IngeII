import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  Body,
  UseGuards,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from '../../common/guards/local-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Nombre de la cookie del Refresh Token; lo reutilizarán /refresh y /logout.
export const REFRESH_COOKIE = 'refresh_token';

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

  // POST /auth/login
  // LocalAuthGuard valida las credenciales (local.strategy.ts) y deja el
  // usuario en request.user. Emite Access Token en el cuerpo y el Refresh
  // Token en una cookie httpOnly que nunca queda expuesta al JS del cliente.
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(
    // El DTO documenta el contrato y activa la validación global del body.
    // La validación de formato efectiva ocurre en local.strategy.ts (ver nota ahí).
    @Body() _loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: Pick<User, 'id' | 'email' | 'role'> }> {
    const user = req.user as User;
    const { accessToken, refreshToken } = await this.authService.login(user);
    this.emitirCookieRefresh(res, refreshToken);

    return {
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
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
  ): Promise<{ accessToken: string; user: Pick<User, 'id' | 'email' | 'role'> }> {
    const tokenPlano = req.cookies?.[REFRESH_COOKIE];
    if (!tokenPlano) {
      throw new UnauthorizedException('Sesión inválida');
    }

    const { accessToken, refreshToken, user } =
      await this.authService.refrescarSesion(tokenPlano);
    this.emitirCookieRefresh(res, refreshToken);

    return {
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  // GET /auth/perfil
  // Primera ruta protegida con JwtAuthGuard: valida el Bearer (jwt.strategy.ts),
  // deja {id, role} en request.user y revalida contra la BD que el usuario
  // siga activo antes de responder.
  @UseGuards(JwtAuthGuard)
  @Get('perfil')
  async perfil(
    @Req() req: Request,
  ): Promise<Pick<User, 'id' | 'email' | 'role'>> {
    const { id } = req.user as { id: number };
    return this.authService.obtenerPerfil(id);
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
