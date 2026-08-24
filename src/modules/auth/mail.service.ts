import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

// Envío de correos del módulo auth. Si otro módulo necesita enviar correos
// más adelante, este servicio se puede mover a common/ y exportarse desde ahí.
@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST'),
      port: Number(this.configService.get<string>('EMAIL_PORT') ?? 587),
      secure: this.configService.get<string>('EMAIL_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASS'),
      },
    });
  }

  async enviarCorreoResetPassword(
    destinatario: string,
    url: string,
  ): Promise<void> {
    await this.transporter.sendMail({
      from:
        this.configService.get<string>('EMAIL_FROM') ??
        'no-reply@asada.local',
      to: destinatario,
      subject: 'Recuperación de contraseña',
      html: `
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p><a href="${url}">Haz clic aquí para restablecerla</a></p>
        <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
      `,
    });
  }

  async enviarCorreoBienvenida(
    destinatario: string,
    url: string,
  ): Promise<void> {
    await this.transporter.sendMail({
      from:
        this.configService.get<string>('EMAIL_FROM') ??
        'no-reply@asada.local',
      to: destinatario,
      subject: 'Bienvenido — Activa tu cuenta',
      html: `
        <p>¡Gracias por registrarte!</p>
        <p>Para activar tu cuenta, haz clic en el siguiente enlace:</p>
        <p><a href="${url}">Activar mi cuenta</a></p>
        <p>Si no creaste esta cuenta, puedes ignorar este correo.</p>
      `,
    });
  }
}