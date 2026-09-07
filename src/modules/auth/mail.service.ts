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
      subject: 'ASADA Pueblo Nuevo — Recuperación de contraseña',
      html: `
        <p><strong>ASADA Pueblo Nuevo</strong></p>
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
      subject: 'ASADA Pueblo Nuevo — Bienvenido, activa tu cuenta',
      html: `
        <p><strong>ASADA Pueblo Nuevo</strong></p>
        <p>¡Gracias por registrarte!</p>
        <p>Para activar tu cuenta, haz clic en el siguiente enlace:</p>
        <p><a href="${url}">Activar mi cuenta</a></p>
        <p>Si no creaste esta cuenta, puedes ignorar este correo.</p>
      `,
    });
  }

  // Correo que recibe un Abonado recién registrado por un administrador:
  // reutiliza el mismo mecanismo (y la misma pantalla /restablecer-password)
  // que "recuperar contraseña", ya que el sistema no distingue entre poner
  // una contraseña por primera vez o cambiar una que ya existía.
  async enviarCorreoAccesoAbonado(
    destinatario: string,
    url: string,
  ): Promise<void> {
    await this.transporter.sendMail({
      from:
        this.configService.get<string>('EMAIL_FROM') ??
        'no-reply@asada.local',
      to: destinatario,
      subject: 'ASADA Pueblo Nuevo — Accede a tu cuenta',
      html: `
        <p><strong>ASADA Pueblo Nuevo</strong></p>
        <p>Se registró tu cuenta en el Sistema de Información de Abonados (SIAPB).</p>
        <p>Para ingresar por primera vez, primero debes crear tu contraseña usando el siguiente enlace:</p>
        <p><a href="${url}">Crear mi contraseña</a></p>
        <p>Si no reconoces esta cuenta, puedes ignorar este correo.</p>
      `,
    });
  }

  // Notificación del resultado de una solicitud gestionada en el dashboard
  // (hoy: cambio de domicilio): informa si fue aprobada o rechazada y, en
  // caso de rechazo, incluye el motivo indicado por el administrador.
  async enviarCorreoResultadoSolicitud(
    destinatario: string,
    datos: {
      tipo: string;
      codigo: string;
      estadoResultado: 'aprobado' | 'rechazado';
      motivo?: string | null;
    },
  ): Promise<void> {
    const esAprobada = datos.estadoResultado === 'aprobado';
    await this.transporter.sendMail({
      from:
        this.configService.get<string>('EMAIL_FROM') ??
        'no-reply@asada.local',
      to: destinatario,
      subject: esAprobada
        ? `ASADA Pueblo Nuevo — Solicitud ${datos.codigo} aprobada`
        : `ASADA Pueblo Nuevo — Solicitud ${datos.codigo} rechazada`,
      html: `
        <p><strong>ASADA Pueblo Nuevo</strong></p>
        <p>Tu solicitud de <strong>${datos.tipo}</strong> con código <strong>${datos.codigo}</strong> fue ${
          esAprobada ? 'aprobada' : 'rechazada'
        }.</p>
        ${
          esAprobada
            ? '<p>Ya puedes ver los cambios actualizados en tu perfil de abonado.</p>'
            : datos.motivo
              ? `<p>Motivo del rechazo: ${datos.motivo}</p>`
              : '<p>Si tenés dudas, contactanos en las oficinas de la ASADA.</p>'
        }
        <p>Gracias por usar el Sistema de Información de Abonados (SIAPB).</p>
      `,
    });
  }
}