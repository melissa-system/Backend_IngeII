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

  // Notificación del resultado de una solicitud de "cambio de representante".
  // Se envía al abonado solicitante y, si el nuevo representante registró su
  // propio correo (distinto del de la cuenta), también a él.
  async enviarCorreoResultadoCambioRepresentante(
    destinatario: string,
    correoNuevoRepresentante: string | null,
    datos: {
      tipo: string;
      codigo: string;
      estadoResultado: 'aprobado' | 'rechazado';
      motivo?: string | null;
      nombreNuevoRepresentante: string;
    },
  ): Promise<void> {
    const esAprobada = datos.estadoResultado === 'aprobado';
    const asuntoBase = esAprobada ? 'aprobada' : 'rechazada';
    const cuerpoSolicitante = esAprobada
      ? `<p>Tu solicitud de <strong>${datos.tipo}</strong> con código <strong>${datos.codigo}</strong> fue <strong>aprobada</strong>.</p>
         <p>Desde ahora, <strong>${datos.nombreNuevoRepresentante}</strong> queda registrado como representante legal de tu cuenta.</p>`
      : `<p>Tu solicitud de <strong>${datos.tipo}</strong> con código <strong>${datos.codigo}</strong> fue <strong>rechazada</strong>.</p>
         ${
           datos.motivo
             ? `<p>Motivo del rechazo: ${datos.motivo}</p>`
             : '<p>Si tenés dudas, contactanos en las oficinas de la ASADA.</p>'
         }`;

    await this.transporter.sendMail({
      from:
        this.configService.get<string>('EMAIL_FROM') ??
        'no-reply@asada.local',
      to: destinatario,
      subject: `ASADA Pueblo Nuevo — Solicitud ${datos.codigo} ${asuntoBase}`,
      html: `
        <p><strong>ASADA Pueblo Nuevo</strong></p>
        ${cuerpoSolicitante}
        <p>Gracias por usar el Sistema de Información de Abonados (SIAPB).</p>
      `,
    });

    // Segundo correo: el nuevo representante, si registró su propio correo y
    // es distinto del correo de la cuenta.
    if (
      correoNuevoRepresentante?.trim() &&
      correoNuevoRepresentante.trim().toLowerCase() !==
        destinatario.toLowerCase()
    ) {
      const cuerpoNuevoRep = esAprobada
        ? `<p>Se te ha registrado como <strong>nuevo representante legal</strong> de una cuenta de <strong>${datos.tipo}</strong> (solicitud <strong>${datos.codigo}</strong> aprobada).</p>`
        : `<p>La solicitud de cambio de representante en la que tu nombre figuraba como nuevo representante (código <strong>${datos.codigo}</strong>) fue <strong>rechazada</strong>.</p>
           ${
             datos.motivo
               ? `<p>Motivo del rechazo: ${datos.motivo}</p>`
               : '<p>Si tenés dudas, contactá a las oficinas de la ASADA.</p>'
           }`;

      await this.transporter.sendMail({
        from:
          this.configService.get<string>('EMAIL_FROM') ??
          'no-reply@asada.local',
        to: correoNuevoRepresentante.trim(),
        subject: `ASADA Pueblo Nuevo — Solicitud ${datos.codigo} ${asuntoBase}`,
        html: `
          <p><strong>ASADA Pueblo Nuevo</strong></p>
          ${cuerpoNuevoRep}
          <p>Gracias por usar el Sistema de Información de Abonados (SIAPB).</p>
        `,
      });
    }
  }
}