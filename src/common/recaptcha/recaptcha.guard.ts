import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { RecaptchaService } from './recaptcha.service';

// Encabezado donde el frontend manda el token de reCAPTCHA.
//
// Va en un encabezado y NO dentro del formulario a propósito: el formulario
// de paja de agua envía archivos (multipart/form-data), y en NestJS los
// guards se ejecutan ANTES que el interceptor que lee ese cuerpo. Si el
// token viajara en el cuerpo, este guard lo vería vacío.
export const ENCABEZADO_RECAPTCHA = 'x-recaptcha-token';

@Injectable()
export class RecaptchaGuard implements CanActivate {
  constructor(private readonly recaptchaService: RecaptchaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const peticion = context.switchToHttp().getRequest<Request>();
    const token = peticion.headers[ENCABEZADO_RECAPTCHA];

    if (typeof token !== 'string' || token.trim() === '') {
      throw new BadRequestException(
        'Debes completar la verificación "No soy un robot" antes de enviar el formulario.',
      );
    }

    const resultado = await this.recaptchaService.verificar(token, peticion.ip);
    if (resultado.valido) return true;

    throw new ForbiddenException(
      resultado.motivo === 'expirado'
        ? 'La verificación "No soy un robot" venció. Vuelve a marcar la casilla e intenta de nuevo.'
        : 'No pudimos confirmar que no eres un robot. Vuelve a marcar la casilla e intenta de nuevo.',
    );
  }
}
