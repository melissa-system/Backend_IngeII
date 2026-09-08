import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

// Envío de correos del módulo auth. Si otro módulo necesita enviar correos
// más adelante, este servicio se puede mover a common/ y exportarse desde ahí.
@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;

  // Mismo azul de marca que el sidebar/header del dashboard
  // (--color-primary-700 en Frontend_IngeII/src/index.css), para que el
  // correo se sienta parte del mismo sistema y no un template genérico.
  private static readonly COLOR_MARCA = '#073763';

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

  // Arma el HTML común a todos los correos (encabezado con el nombre de la
  // ASADA, tarjeta blanca centrada, botón de acción centrado y pie con
  // aviso legal) para que no queden inconsistentes entre sí. Usa tablas y
  // estilos inline a propósito: es lo único que Gmail/Outlook/Apple Mail
  // renderizan de forma confiable, un <link>/<style> externo no sirve acá.
  private plantillaBase(datos: {
    tituloEncabezado?: string;
    saludo: string;
    parrafos: string[];
    boton?: { texto: string; url: string };
    notaFinal?: string;
  }): string {
    const color = MailService.COLOR_MARCA;
    const año = new Date().getFullYear();

    const parrafosHtml = datos.parrafos
      .map(
        (p) =>
          `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${p}</p>`,
      )
      .join('');

    const botonHtml = datos.boton
      ? `
        <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 24px;">
          <tr>
            <td align="center" bgcolor="${color}" style="border-radius:8px;">
              <a href="${datos.boton.url}" target="_blank" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:8px;font-family:Arial, Helvetica, sans-serif;">${datos.boton.texto}</a>
            </td>
          </tr>
        </table>`
      : '';

    return `
<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background-color:${color};padding:28px 32px;text-align:center;">
                <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;font-family:Arial, Helvetica, sans-serif;">ASADA Pueblo Nuevo</p>
                <p style="margin:6px 0 0;color:#cfe0f0;font-size:12px;font-family:Arial, Helvetica, sans-serif;">${
                  datos.tituloEncabezado ?? 'Sistema de Información de Abonados'
                }</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">${datos.saludo}</p>
                ${parrafosHtml}
                ${botonHtml}
                ${
                  datos.notaFinal
                    ? `<p style="margin:24px 0 0;color:#9ca3af;font-size:12px;line-height:1.5;">${datos.notaFinal}</p>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="background-color:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
                <p style="margin:0;color:#9ca3af;font-size:11px;font-family:Arial, Helvetica, sans-serif;">© ${año} ASADA Pueblo Nuevo. Todos los derechos reservados.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
      html: this.plantillaBase({
        tituloEncabezado: 'Recuperación de contraseña',
        saludo: 'Hola,',
        parrafos: [
          'Recibimos una solicitud para restablecer la contraseña de tu cuenta en el Sistema de Información de Abonados (SIAPB).',
          'Hacé clic en el siguiente botón para crear una nueva contraseña. Por tu seguridad, este enlace vence en poco tiempo.',
        ],
        boton: { texto: 'Restablecer mi contraseña', url },
        notaFinal:
          'Si no solicitaste este cambio, podés ignorar este correo: tu contraseña actual seguirá funcionando sin problema.',
      }),
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
      html: this.plantillaBase({
        tituloEncabezado: 'Activación de cuenta',
        saludo: '¡Hola!',
        parrafos: [
          'Gracias por registrarte en el Sistema de Información de Abonados (SIAPB) de la ASADA Pueblo Nuevo.',
          'Para activar tu cuenta y empezar a usarla, hacé clic en el siguiente botón:',
        ],
        boton: { texto: 'Activar mi cuenta', url },
        notaFinal:
          'Si no creaste esta cuenta, podés ignorar este correo sin problema.',
      }),
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
      html: this.plantillaBase({
        tituloEncabezado: 'Acceso a tu cuenta',
        saludo: 'Hola,',
        parrafos: [
          'Se registró una cuenta a tu nombre en el Sistema de Información de Abonados (SIAPB) de la ASADA Pueblo Nuevo.',
          'Para ingresar por primera vez, primero tenés que crear tu contraseña haciendo clic en el siguiente botón:',
        ],
        boton: { texto: 'Crear mi contraseña', url },
        notaFinal:
          'Si no reconocés esta cuenta, podés ignorar este correo sin problema.',
      }),
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
      html: this.plantillaBase({
        tituloEncabezado: 'Resultado de tu solicitud',
        saludo: 'Hola,',
        parrafos: [
          `Tu solicitud de <strong>${datos.tipo}</strong> con código <strong>${datos.codigo}</strong> fue <strong>${
            esAprobada ? 'aprobada' : 'rechazada'
          }</strong>.`,
          esAprobada
            ? 'Ya podés ver los cambios actualizados en tu perfil de abonado.'
            : datos.motivo
              ? `Motivo del rechazo: ${datos.motivo}`
              : 'Si tenés dudas, contactanos en las oficinas de la ASADA.',
        ],
        notaFinal: 'Gracias por usar el Sistema de Información de Abonados (SIAPB).',
      }),
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

    const parrafosSolicitante = esAprobada
      ? [
          `Tu solicitud de <strong>${datos.tipo}</strong> con código <strong>${datos.codigo}</strong> fue <strong>aprobada</strong>.`,
          `Desde ahora, <strong>${datos.nombreNuevoRepresentante}</strong> queda registrado como representante legal de tu cuenta.`,
        ]
      : [
          `Tu solicitud de <strong>${datos.tipo}</strong> con código <strong>${datos.codigo}</strong> fue <strong>rechazada</strong>.`,
          datos.motivo
            ? `Motivo del rechazo: ${datos.motivo}`
            : 'Si tenés dudas, contactanos en las oficinas de la ASADA.',
        ];

    await this.transporter.sendMail({
      from:
        this.configService.get<string>('EMAIL_FROM') ??
        'no-reply@asada.local',
      to: destinatario,
      subject: `ASADA Pueblo Nuevo — Solicitud ${datos.codigo} ${asuntoBase}`,
      html: this.plantillaBase({
        tituloEncabezado: 'Resultado de tu solicitud',
        saludo: 'Hola,',
        parrafos: parrafosSolicitante,
        notaFinal: 'Gracias por usar el Sistema de Información de Abonados (SIAPB).',
      }),
    });

    // Segundo correo: el nuevo representante, si registró su propio correo y
    // es distinto del correo de la cuenta.
    if (
      correoNuevoRepresentante?.trim() &&
      correoNuevoRepresentante.trim().toLowerCase() !==
        destinatario.toLowerCase()
    ) {
      const parrafosNuevoRep = esAprobada
        ? [
            `Se te ha registrado como <strong>nuevo representante legal</strong> de una cuenta de <strong>${datos.tipo}</strong> (solicitud <strong>${datos.codigo}</strong> aprobada).`,
          ]
        : [
            `La solicitud de cambio de representante en la que tu nombre figuraba como nuevo representante (código <strong>${datos.codigo}</strong>) fue <strong>rechazada</strong>.`,
            datos.motivo
              ? `Motivo del rechazo: ${datos.motivo}`
              : 'Si tenés dudas, contactá a las oficinas de la ASADA.',
          ];

      await this.transporter.sendMail({
        from:
          this.configService.get<string>('EMAIL_FROM') ??
          'no-reply@asada.local',
        to: correoNuevoRepresentante.trim(),
        subject: `ASADA Pueblo Nuevo — Solicitud ${datos.codigo} ${asuntoBase}`,
        html: this.plantillaBase({
          tituloEncabezado: 'Resultado de tu solicitud',
          saludo: 'Hola,',
          parrafos: parrafosNuevoRep,
          notaFinal: 'Gracias por usar el Sistema de Información de Abonados (SIAPB).',
        }),
      });
    }
  }
}
