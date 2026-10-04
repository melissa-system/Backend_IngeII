import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Opciones de botón de llamada a la acción (CTA) para las plantillas de correo.
 */
export interface BotonAccion {
  texto: string;
  url: string;
}

/**
 * Opciones para la construcción del layout base de correos.
 */
export interface PlantillaOpciones {
  titulo: string;
  cuerpoHtml: string;
  boton?: BotonAccion;
  avisoPie?: string;
}

/**
 * Servicio centralizado para el diseño, composición y envío de correos electrónicos
 * de la ASADA Pueblo Nuevo (PBI 518 - Tasks 520 y 521).
 *
 * Emplea un layout unificado responsivo, accesible y optimizado para clientes de
 * correo modernos y tradicionales (Gmail, Outlook, Apple Mail, clientes móviles).
 */
@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;

  // Paleta de colores institucional unificada con la marca del sistema
  private static readonly COLOR_PRIMARIO = '#073763'; // Azul marino ASADA (--color-primary-700)
  private static readonly COLOR_BOTON = '#073763'; // Azul institucional de acción
  private static readonly COLOR_FONDO = '#f4f6f8'; // Fondo neutro suave
  private static readonly COLOR_TARJETA = '#ffffff'; // Tarjeta central blanca
  private static readonly COLOR_TEXTO = '#1f2937'; // Gris oscuro para lectura óptima
  private static readonly COLOR_MUTED = '#6b7280'; // Texto secundario / footer

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

  /**
   * Obtiene el nombre institucional configurado o el predeterminado.
   */
  private get nombreAsada(): string {
    return (
      this.configService.get<string>('ASADA_NOMBRE') ?? 'ASADA Pueblo Nuevo'
    );
  }

  /**
   * Obtiene el subtítulo institucional para el encabezado del correo.
   */
  private get subtituloAsada(): string {
    return (
      this.configService.get<string>('ASADA_SUBTITULO') ??
      'Sistema de Información y Administración de Acueductos'
    );
  }

  /**
   * Obtiene los datos de contacto institucionales para el footer.
   */
  private get datosContactoFooter(): string {
    const telefono =
      this.configService.get<string>('ASADA_TELEFONO') ?? '(506) 2685-0000';
    const correo =
      this.configService.get<string>('ASADA_EMAIL_CONTACTO') ??
      'info@asada.local';
    return `${this.nombreAsada} • Tel: ${telefono} • ${correo}`;
  }

  /**
   * Obtiene la URL pública del frontend respetando CORS y variables de entorno.
   */
  private urlFrontendPublica(): string {
    const publica = this.configService.get<string>('PUBLIC_APP_URL');
    if (publica?.trim()) return publica.trim();

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ??
      'http://localhost:5173';
    return frontendUrl.split(',')[0].trim();
  }

  /**
   * Sanitiza cadenas de texto dinámicas para prevenir inyecciones HTML en plantillas.
   */
  private escapeHtml(texto?: string | null): string {
    if (!texto) return '';
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Helper para renderizar un badge estilizado de estado (Aprobado / Rechazado).
   */
  private renderBadgeEstado(estado: string): string {
    const normalizado = estado.trim().toLowerCase();
    const esAprobado = normalizado === 'aprobado' || normalizado === 'aprobada';

    const bg = esAprobado ? '#dcfce7' : '#fee2e2';
    const text = esAprobado ? '#166534' : '#991b1b';
    const border = esAprobado ? '#bbf7d0' : '#fecaca';
    const label = esAprobado ? 'APROBADA' : 'RECHAZADA';

    return `
      <span style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:700;letter-spacing:0.5px;background-color:${bg};color:${text};border:1px solid ${border};text-transform:uppercase;">
        ${label}
      </span>
    `;
  }

  /**
   * Helper para renderizar una ficha o resumen de detalles con pares clave-valor.
   */
  private renderFichaDetalles(
    detalles: Array<{ etiqueta: string; valor: string }>,
  ): string {
    const filas = detalles
      .map(
        (d, idx) => `
        <tr style="border-bottom:${idx === detalles.length - 1 ? 'none' : '1px solid #e5e7eb'};">
          <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#4b5563;width:35%;vertical-align:middle;background-color:#f9fafb;">
            ${d.etiqueta}
          </td>
          <td style="padding:10px 14px;font-size:14px;color:#111827;vertical-align:middle;">
            ${d.valor}
          </td>
        </tr>`,
      )
      .join('');

    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;border-collapse:collapse;">
        ${filas}
      </table>
    `;
  }

  /**
   * Helper para renderizar una caja de alerta o nota destacada.
   */
  private renderCajaAlerta(
    contenido: string,
    tipo: 'info' | 'warning' | 'danger' = 'info',
  ): string {
    const config = {
      info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', title: 'Información' },
      warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', title: 'Importante' },
      danger: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', title: 'Motivo del Rechazo' },
    }[tipo];

    return `
      <div style="margin:20px 0;padding:14px 16px;background-color:${config.bg};border-left:4px solid ${config.border};border-radius:6px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${config.text};">${config.title}:</p>
        <p style="margin:0;font-size:14px;line-height:1.5;color:${config.text};">${contenido}</p>
      </div>
    `;
  }

  /**
   * Task 520: Genera el layout base HTML unificado institucional.
   *
   * Diseñado mediante tablas HTML puras y estilos inline para máxima compatibilidad con
   * Gmail, Outlook desktop/web, iOS Mail, Android y clientes web. Ancho máximo: 600px.
   */
  public plantillaBase(opciones: PlantillaOpciones): string {
    const colorPrimario = MailService.COLOR_PRIMARIO;
    const colorBoton = MailService.COLOR_BOTON;
    const colorFondo = MailService.COLOR_FONDO;
    const colorTarjeta = MailService.COLOR_TARJETA;
    const colorTexto = MailService.COLOR_TEXTO;
    const colorMuted = MailService.COLOR_MUTED;
    const añoActual = new Date().getFullYear();

    const logoUrl = this.configService.get<string>('ASADA_LOGO_URL');

    // Botón de llamada a la acción (CTA) opcional
    const botonHtml = opciones.boton
      ? `
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 20px;">
        <tr>
          <td align="center" bgcolor="${colorBoton}" style="border-radius:8px;box-shadow:0 2px 4px rgba(7,55,99,0.2);">
            <a href="${opciones.boton.url}" target="_blank" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:8px;font-family:Arial, Helvetica, sans-serif;letter-spacing:0.3px;">
              ${this.escapeHtml(opciones.boton.texto)}
            </a>
          </td>
        </tr>
      </table>`
      : '';

    // Aviso al pie opcional dentro de la tarjeta
    const avisoPieHtml = opciones.avisoPie
      ? `
      <div style="margin-top:24px;padding-top:16px;border-top:1px dashed #e5e7eb;">
        <p style="margin:0;color:${colorMuted};font-size:12px;line-height:1.5;font-style:italic;">
          ${opciones.avisoPie}
        </p>
      </div>`
      : '';

    // Encabezado con soporte para logo institucional o tipografía destacada
    const headerContent = logoUrl
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
          <tr>
            <td align="center" style="padding-bottom:10px;">
              <img src="${logoUrl}" alt="${this.escapeHtml(this.nombreAsada)}" width="140" style="display:block;max-width:140px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td align="center">
              <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.5px;font-family:Arial, Helvetica, sans-serif;">${this.escapeHtml(this.nombreAsada)}</h1>
              <p style="margin:4px 0 0;color:#d0e1f3;font-size:12px;font-family:Arial, Helvetica, sans-serif;">${this.escapeHtml(this.subtituloAsada)}</p>
            </td>
          </tr>
        </table>`
      : `
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;font-family:Arial, Helvetica, sans-serif;">${this.escapeHtml(this.nombreAsada)}</h1>
        <p style="margin:6px 0 0;color:#d0e1f3;font-size:12px;font-family:Arial, Helvetica, sans-serif;">${this.escapeHtml(this.subtituloAsada)}</p>
      `;

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${this.escapeHtml(opciones.titulo)}</title>
</head>
<body style="margin:0;padding:0;background-color:${colorFondo};font-family:Arial, Helvetica, sans-serif;-webkit-font-smoothing:antialiased;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${colorFondo};padding:32px 16px;">
    <tr>
      <td align="center">
        <!-- Tarjeta Central Principal (Máx 600px) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:${colorTarjeta};border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header Banner Institucional -->
          <tr>
            <td style="background-color:${colorPrimario};padding:28px 32px;text-align:center;">
              ${headerContent}
            </td>
          </tr>

          <!-- Título Destacado del Correo -->
          <tr>
            <td style="padding:28px 32px 0 32px;background-color:${colorTarjeta};">
              <h2 style="margin:0;color:${colorTexto};font-size:20px;font-weight:bold;line-height:1.4;font-family:Arial, Helvetica, sans-serif;">
                ${this.escapeHtml(opciones.titulo)}
              </h2>
              <div style="height:3px;width:40px;background-color:${colorPrimario};margin:10px 0 0 0;border-radius:2px;"></div>
            </td>
          </tr>

          <!-- Cuerpo Dinámico -->
          <tr>
            <td style="padding:20px 32px 28px 32px;background-color:${colorTarjeta};">
              <div style="color:${colorTexto};font-size:15px;line-height:1.6;font-family:Arial, Helvetica, sans-serif;">
                ${opciones.cuerpoHtml}
              </div>
              ${botonHtml}
              ${avisoPieHtml}
            </td>
          </tr>

          <!-- Pie de Página Institucional -->
          <tr>
            <td style="background-color:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 6px;color:#4b5563;font-size:12px;font-weight:600;font-family:Arial, Helvetica, sans-serif;">
                ${this.escapeHtml(this.datosContactoFooter)}
              </p>
              <p style="margin:0 0 10px;color:${colorMuted};font-size:11px;font-family:Arial, Helvetica, sans-serif;">
                Este es un correo generado automáticamente por el sistema institucional. Por favor no responda a este mensaje.
              </p>
              <p style="margin:0;color:#9ca3af;font-size:11px;font-family:Arial, Helvetica, sans-serif;">
                &copy; ${añoActual} ${this.escapeHtml(this.nombreAsada)}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Task 521: Migración Unificada de los 8 Métodos Existentes
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 1. Recuperación de contraseña:
   * Explica la solicitud de restablecimiento, indica vigencia limitada y provee el CTA.
   */
  async enviarCorreoResetPassword(
    destinatario: string,
    url: string,
  ): Promise<void> {
    const titulo = 'Recuperación de Contraseña';
    const cuerpoHtml = `
      <p style="margin:0 0 16px;">Estimado(a) usuario(a),</p>
      <p style="margin:0 0 16px;">
        Hemos recibido una solicitud para restablecer la contraseña de acceso a su cuenta en el
        <strong>${this.escapeHtml(this.subtituloAsada)}</strong> de la ${this.escapeHtml(this.nombreAsada)}.
      </p>
      <p style="margin:0 0 16px;">
        Para crear una nueva contraseña y recuperar el acceso a su cuenta, haga clic en el siguiente botón:
      </p>
      ${this.renderCajaAlerta(
        'Por su seguridad, este enlace tiene una validez temporal y expirará pronto.',
        'warning',
      )}
    `;

    await this.transporter.sendMail({
      from:
        this.configService.get<string>('EMAIL_FROM') ??
        'no-reply@asada.local',
      to: destinatario,
      subject: `${this.nombreAsada} — Recuperación de Contraseña`,
      html: this.plantillaBase({
        titulo,
        cuerpoHtml,
        boton: { texto: 'Restablecer mi contraseña', url },
        avisoPie:
          'Si usted no solicitó este cambio de contraseña, ignore este mensaje. Su contraseña actual continuará funcionando de forma segura.',
      }),
    });
  }

  /**
   * 2. Activación de cuenta:
   * Notifica el auto-registro exitoso e instruye activar la cuenta mediante el enlace.
   */
  async enviarCorreoBienvenida(
    destinatario: string,
    url: string,
  ): Promise<void> {
    const titulo = 'Activación de Cuenta - ASADA';
    const cuerpoHtml = `
      <p style="margin:0 0 16px;">¡Le damos una cordial bienvenida!</p>
      <p style="margin:0 0 16px;">
        Agradecemos su registro en la plataforma digital de la <strong>${this.escapeHtml(
          this.nombreAsada,
        )}</strong>.
      </p>
      <p style="margin:0 0 16px;">
        Para completar la verificación de su dirección de correo electrónico y activar su cuenta en el sistema, por favor pulse el siguiente botón:
      </p>
      ${this.renderCajaAlerta(
        'Una vez activada la cuenta, podrá ingresar a su panel de abonado y gestionar trámites, averías y consultas en línea.',
        'info',
      )}
    `;

    await this.transporter.sendMail({
      from:
        this.configService.get<string>('EMAIL_FROM') ??
        'no-reply@asada.local',
      to: destinatario,
      subject: `${this.nombreAsada} — Bienvenido(a), activa tu cuenta`,
      html: this.plantillaBase({
        titulo,
        cuerpoHtml,
        boton: { texto: 'Activar mi cuenta', url },
        avisoPie:
          'Si usted no realizó esta solicitud de registro, puede desestimar este mensaje sin inconveniente.',
      }),
    });
  }

  /**
   * 3. Acceso de abonado creado por administración:
   * Notifica el alta administrativa de la cuenta y solicita definir la contraseña inicial.
   */
  async enviarCorreoAccesoAbonado(
    destinatario: string,
    url: string,
  ): Promise<void> {
    const titulo = 'Acceso al Sistema de Abonados';
    const cuerpoHtml = `
      <p style="margin:0 0 16px;">Estimado(a) abonado(a),</p>
      <p style="margin:0 0 16px;">
        Le informamos que el personal administrativo de la <strong>${this.escapeHtml(
          this.nombreAsada,
        )}</strong> ha registrado y habilitado satisfactoriamente su cuenta de acceso en el sistema institucional.
      </p>
      <p style="margin:0 0 16px;">
        Para ingresar por primera vez a su portal, es necesario que configure su clave de acceso personal haciendo clic en el siguiente enlace:
      </p>
    `;

    await this.transporter.sendMail({
      from:
        this.configService.get<string>('EMAIL_FROM') ??
        'no-reply@asada.local',
      to: destinatario,
      subject: `${this.nombreAsada} — Acceso al Sistema de Abonados`,
      html: this.plantillaBase({
        titulo,
        cuerpoHtml,
        boton: { texto: 'Establecer Contraseña', url },
        avisoPie:
          'Por motivos de seguridad, nunca comparta su enlace ni su contraseña con terceras personas.',
      }),
    });
  }

  /**
   * 4. Resultado de solicitud (cambio de medidor y conexión de paja de agua):
   * Muestra ficha destacada con código, tipo, badge de estado y motivo si fue rechazada.
   */
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
    const titulo = 'Resolución de Solicitud de Trámite';

    const detalles = [
      { etiqueta: 'Código de Trámite', valor: `<strong>${this.escapeHtml(datos.codigo)}</strong>` },
      { etiqueta: 'Tipo de Solicitud', valor: this.escapeHtml(datos.tipo) },
      { etiqueta: 'Estado de Resolución', valor: this.renderBadgeEstado(datos.estadoResultado) },
    ];

    const mensajeResolucion = esAprobada
      ? `<p style="margin:0 0 16px;color:#166534;font-weight:600;">
          Su solicitud ha sido aprobada favorablemente. Los cambios correspondientes han sido actualizados en los registros de su servicio.
        </p>`
      : `<p style="margin:0 0 16px;color:#991b1b;font-weight:600;">
          Su solicitud ha sido revisada y denegada por la administración.
        </p>
        ${
          datos.motivo
            ? this.renderCajaAlerta(this.escapeHtml(datos.motivo), 'danger')
            : this.renderCajaAlerta(
                'Para más información sobre los motivos del rechazo, le invitamos a contactar al personal de atención en la oficina de la ASADA.',
                'info',
              )
        }`;

    const cuerpoHtml = `
      <p style="margin:0 0 16px;">Estimado(a) abonado(a),</p>
      <p style="margin:0 0 16px;">
        Le notificamos el dictamen oficial emitido respecto a su gestión de trámite:
      </p>
      ${this.renderFichaDetalles(detalles)}
      ${mensajeResolucion}
    `;

    await this.transporter.sendMail({
      from:
        this.configService.get<string>('EMAIL_FROM') ??
        'no-reply@asada.local',
      to: destinatario,
      subject: esAprobada
        ? `${this.nombreAsada} — Solicitud ${datos.codigo} aprobada`
        : `${this.nombreAsada} — Solicitud ${datos.codigo} rechazada`,
      html: this.plantillaBase({
        titulo,
        cuerpoHtml,
        avisoPie:
          'Puede consultar el historial y constancias de todas sus solicitudes ingresando a su portal de abonado.',
      }),
    });
  }

  /**
   * 5. Resultado de solicitud de trámite general ("otro"):
   * Incluye ficha con código, asunto, estado y comentarios emitidos por el administrador.
   */
  async enviarCorreoResultadoOtro(
    destinatario: string,
    datos: {
      codigo: string;
      estadoResultado: 'aprobado' | 'rechazado';
      asunto: string;
      comentario?: string | null;
    },
  ): Promise<void> {
    const esAprobada = datos.estadoResultado === 'aprobado';
    const titulo = 'Resolución de Solicitud General';

    const detalles = [
      { etiqueta: 'Código de Solicitud', valor: `<strong>${this.escapeHtml(datos.codigo)}</strong>` },
      { etiqueta: 'Asunto de la Gestión', valor: this.escapeHtml(datos.asunto) },
      { etiqueta: 'Estado de Resolución', valor: this.renderBadgeEstado(datos.estadoResultado) },
    ];

    const comentarioHtml = datos.comentario
      ? this.renderCajaAlerta(this.escapeHtml(datos.comentario), esAprobada ? 'info' : 'danger')
      : '<p style="margin:0 0 16px;color:#6b7280;font-style:italic;">No se registraron observaciones adicionales por parte de la administración.</p>';

    const cuerpoHtml = `
      <p style="margin:0 0 16px;">Estimado(a) abonado(a),</p>
      <p style="margin:0 0 16px;">
        Le comunicamos que su solicitud general ha sido atendida y resuelta formalmente por la administración de la ASADA:
      </p>
      ${this.renderFichaDetalles(detalles)}
      <p style="margin:0 0 8px;font-weight:600;color:#374151;">Dictamen y comentarios de la administración:</p>
      ${comentarioHtml}
    `;

    await this.transporter.sendMail({
      from:
        this.configService.get<string>('EMAIL_FROM') ??
        'no-reply@asada.local',
      to: destinatario,
      subject: `${this.nombreAsada} — Solicitud ${datos.codigo} ${
        esAprobada ? 'aprobada' : 'rechazada'
      }`,
      html: this.plantillaBase({
        titulo,
        cuerpoHtml,
        avisoPie:
          'Si requiere asistencia o aclaración adicional sobre esta respuesta, comuníquese con las oficinas de la ASADA.',
      }),
    });
  }

  /**
   * 6. Resultado de solicitud de cambio de representante legal:
   * Detalla la resolución y notifica tanto al solicitante como al nuevo representante (si tiene correo propio).
   */
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
    const titulo = 'Resolución de Trámite de Personería Jurídica';
    const asuntoBase = esAprobada ? 'aprobada' : 'rechazada';

    const detalles = [
      { etiqueta: 'Código de Trámite', valor: `<strong>${this.escapeHtml(datos.codigo)}</strong>` },
      { etiqueta: 'Tipo de Trámite', valor: this.escapeHtml(datos.tipo) },
      { etiqueta: 'Nuevo Representante', valor: this.escapeHtml(datos.nombreNuevoRepresentante) },
      { etiqueta: 'Estado de Resolución', valor: this.renderBadgeEstado(datos.estadoResultado) },
    ];

    const mensajeSolicitante = esAprobada
      ? `<p style="margin:0 0 16px;color:#166534;font-weight:600;">
          Su solicitud ha sido aprobada. A partir de este momento, <strong>${this.escapeHtml(
            datos.nombreNuevoRepresentante,
          )}</strong> queda formalmente registrado(a) como representante legal de la cuenta de abonado.
        </p>`
      : `<p style="margin:0 0 16px;color:#991b1b;font-weight:600;">
          La solicitud de cambio de representante legal ha sido denegada.
        </p>
        ${
          datos.motivo
            ? this.renderCajaAlerta(this.escapeHtml(datos.motivo), 'danger')
            : this.renderCajaAlerta('Para más detalles, favor consultar en las oficinas de la ASADA.', 'info')
        }`;

    const cuerpoSolicitante = `
      <p style="margin:0 0 16px;">Estimado(a) abonado(a),</p>
      <p style="margin:0 0 16px;">
        Le compartimos la resolución administrativa emitida respecto al trámite de acreditación de personería jurídica:
      </p>
      ${this.renderFichaDetalles(detalles)}
      ${mensajeSolicitante}
    `;

    // 1. Envío al solicitante titular
    await this.transporter.sendMail({
      from:
        this.configService.get<string>('EMAIL_FROM') ??
        'no-reply@asada.local',
      to: destinatario,
      subject: `${this.nombreAsada} — Solicitud ${datos.codigo} ${asuntoBase}`,
      html: this.plantillaBase({
        titulo,
        cuerpoHtml: cuerpoSolicitante,
        avisoPie:
          'Este cambio queda registrado en la bitácora legal del sistema de abonados de la ASADA.',
      }),
    });

    // 2. Envío al nuevo representante si su correo es distinto
    if (
      correoNuevoRepresentante?.trim() &&
      correoNuevoRepresentante.trim().toLowerCase() !==
        destinatario.toLowerCase()
    ) {
      const mensajeNuevoRep = esAprobada
        ? `<p style="margin:0 0 16px;color:#166534;font-weight:600;">
            Le informamos formalmente que usted ha sido acreditado(a) como representante legal registrado(a) de la cuenta vinculada a este trámite.
          </p>`
        : `<p style="margin:0 0 16px;color:#991b1b;font-weight:600;">
            La solicitud de designación de representación legal en la que usted fue postulado(a) no fue aprobada por la administración.
          </p>
          ${
            datos.motivo
              ? this.renderCajaAlerta(this.escapeHtml(datos.motivo), 'danger')
              : ''
          }`;

      const cuerpoNuevoRep = `
        <p style="margin:0 0 16px;">Estimado(a) <strong>${this.escapeHtml(
          datos.nombreNuevoRepresentante,
        )}</strong>,</p>
        <p style="margin:0 0 16px;">
          Le notificamos la resolución correspondiente al trámite de acreditación legal ante la <strong>${this.escapeHtml(
            this.nombreAsada,
          )}</strong>:
        </p>
        ${this.renderFichaDetalles(detalles)}
        ${mensajeNuevoRep}
      `;

      await this.transporter.sendMail({
        from:
          this.configService.get<string>('EMAIL_FROM') ??
          'no-reply@asada.local',
        to: correoNuevoRepresentante.trim(),
        subject: `${this.nombreAsada} — Solicitud ${datos.codigo} ${asuntoBase}`,
        html: this.plantillaBase({
          titulo,
          cuerpoHtml: cuerpoNuevoRep,
          avisoPie:
            'Para cualquier trámite administrativo futuro, podrá identificarse como apoderado legal activo.',
        }),
      });
    }
  }

  /**
   * 7. Resultado de solicitud de cambio de propietario (cesión de derechos):
   * Notifica el resultado del traspaso tanto al titular cedente como al nuevo adquirente.
   */
  async enviarCorreoResultadoCambioPropietario(
    destinatario: string,
    correoNuevoPropietario: string | null,
    datos: {
      tipo: string;
      codigo: string;
      estadoResultado: 'aprobado' | 'rechazado';
      motivo?: string | null;
      nombreNuevoPropietario: string;
    },
  ): Promise<void> {
    const esAprobada = datos.estadoResultado === 'aprobado';
    const titulo = 'Resolución de Traspaso de Titularidad';
    const asuntoBase = esAprobada ? 'aprobada' : 'rechazada';

    const detalles = [
      { etiqueta: 'Código de Trámite', valor: `<strong>${this.escapeHtml(datos.codigo)}</strong>` },
      { etiqueta: 'Tipo de Trámite', valor: this.escapeHtml(datos.tipo) },
      { etiqueta: 'Nuevo Titular', valor: this.escapeHtml(datos.nombreNuevoPropietario) },
      { etiqueta: 'Estado de Resolución', valor: this.renderBadgeEstado(datos.estadoResultado) },
    ];

    const mensajeCedente = esAprobada
      ? `<p style="margin:0 0 16px;color:#166534;font-weight:600;">
          El traspaso de titularidad de la paja de agua a favor de <strong>${this.escapeHtml(
            datos.nombreNuevoPropietario,
          )}</strong> ha sido completado y formalizado satisfactoriamente en los registros institucionales.
        </p>`
      : `<p style="margin:0 0 16px;color:#991b1b;font-weight:600;">
          La solicitud de cesión de derechos no ha sido aprobada por la administración.
        </p>
        ${
          datos.motivo
            ? this.renderCajaAlerta(this.escapeHtml(datos.motivo), 'danger')
            : this.renderCajaAlerta('Si tiene dudas sobre el trámite, puede presentarse en la oficina de la ASADA.', 'info')
        }`;

    const cuerpoCedente = `
      <p style="margin:0 0 16px;">Estimado(a) abonado(a),</p>
      <p style="margin:0 0 16px;">
        Le comunicamos la resolución formal referente a la cesión y traspaso de derechos de su servicio de agua potable:
      </p>
      ${this.renderFichaDetalles(detalles)}
      ${mensajeCedente}
    `;

    // 1. Envío al titular anterior (cedente)
    await this.transporter.sendMail({
      from:
        this.configService.get<string>('EMAIL_FROM') ??
        'no-reply@asada.local',
      to: destinatario,
      subject: `${this.nombreAsada} — Solicitud ${datos.codigo} ${asuntoBase}`,
      html: this.plantillaBase({
        titulo,
        cuerpoHtml: cuerpoCedente,
        avisoPie:
          'Se deja constancia en el expediente de abonado de la ASADA Pueblo Nuevo.',
      }),
    });

    // 2. Envío al nuevo propietario (cesionario) si tiene correo propio
    if (
      correoNuevoPropietario?.trim() &&
      correoNuevoPropietario.trim().toLowerCase() !== destinatario.toLowerCase()
    ) {
      const mensajeCesionario = esAprobada
        ? `<p style="margin:0 0 16px;color:#166534;font-weight:600;">
            Le informamos con agrado que el traspaso de la paja de agua a su nombre ha sido aprobado. A partir de esta fecha usted figura como el titular formal del servicio en el padrón de la ASADA.
          </p>`
        : `<p style="margin:0 0 16px;color:#991b1b;font-weight:600;">
            La solicitud de cesión de derechos no ha sido aprobada por la administración.
          </p>
          ${
            datos.motivo
              ? this.renderCajaAlerta(this.escapeHtml(datos.motivo), 'danger')
              : ''
          }`;

      const cuerpoCesionario = `
        <p style="margin:0 0 16px;">Estimado(a) <strong>${this.escapeHtml(
          datos.nombreNuevoPropietario,
        )}</strong>,</p>
        <p style="margin:0 0 16px;">
          Le notificamos el dictamen del trámite de cesión de derechos ante la <strong>${this.escapeHtml(
            this.nombreAsada,
          )}</strong>:
        </p>
        ${this.renderFichaDetalles(detalles)}
        ${mensajeCesionario}
      `;

      await this.transporter.sendMail({
        from:
          this.configService.get<string>('EMAIL_FROM') ??
          'no-reply@asada.local',
        to: correoNuevoPropietario.trim(),
        subject: `${this.nombreAsada} — Solicitud ${datos.codigo} ${asuntoBase}`,
        html: this.plantillaBase({
          titulo,
          cuerpoHtml: cuerpoCesionario,
          avisoPie:
            'A partir del próximo periodo de facturación, los recibos e informes del servicio se emitirán a su nombre.',
        }),
      });
    }
  }

  /**
   * 8. Resultado de solicitud pública de paja de agua:
   * Notifica la resolución inicial y orienta detalladamente sobre los siguientes pasos (permisos y conexión).
   */
  async enviarCorreoResultadoPajaAgua(
    destinatario: string,
    datos: {
      codigo: string;
      estadoResultado: 'Aprobada' | 'Rechazada';
      motivo?: string | null;
    },
  ): Promise<void> {
    const esAprobada = datos.estadoResultado === 'Aprobada';
    const titulo = 'Resolución de Solicitud de Paja de Agua';
    const urlDashboard = `${this.urlFrontendPublica()}/login`;

    const detalles = [
      { etiqueta: 'Código de Solicitud', valor: `<strong>${this.escapeHtml(datos.codigo)}</strong>` },
      { etiqueta: 'Tipo de Servicio', valor: 'Nueva Paja de Agua' },
      { etiqueta: 'Estado de Resolución', valor: this.renderBadgeEstado(datos.estadoResultado) },
    ];

    const mensajeResolucion = esAprobada
      ? `
        <p style="margin:0 0 16px;color:#166534;font-weight:600;">
          Su solicitud de factibilidad para una nueva paja de agua ha sido <strong>APROBADA</strong> por la junta técnica.
        </p>
        <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
          <h3 style="margin:0 0 10px;font-size:14px;color:#166534;font-weight:bold;">Siguientes pasos obligatorios para su conexión:</h3>
          <ol style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.6;">
            <li style="margin-bottom:8px;">
              <strong>Permisos de Construcción y Municipales:</strong> Gestione los permisos correspondientes ante el gobierno local (Municipalidad) y Ministerio de Salud.
            </li>
            <li style="margin-bottom:8px;">
              <strong>Solicitud de Conexión en el Portal:</strong> Una vez cuente con dichos documentos, ingrese a su portal de abonado y complete la <em>"Solicitud de Conexión de Paja de Agua"</em> adjuntando los requisitos.
            </li>
            <li>
              <strong>Acceso a su cuenta:</strong> Si es un usuario nuevo, le enviamos un correo independiente para definir su contraseña de ingreso.
            </li>
          </ol>
        </div>`
      : `
        <p style="margin:0 0 16px;color:#991b1b;font-weight:600;">
          Su solicitud de paja de agua ha sido denegada tras la evaluación técnica institucional.
        </p>
        ${
          datos.motivo
            ? this.renderCajaAlerta(this.escapeHtml(datos.motivo), 'danger')
            : this.renderCajaAlerta(
                'Para consultar detalles sobre las restricciones técnicas o disponibilidad en la zona, favor acudir a nuestras oficinas.',
                'info',
              )
        }`;

    const cuerpoHtml = `
      <p style="margin:0 0 16px;">Estimado(a) solicitante,</p>
      <p style="margin:0 0 16px;">
        Le notificamos el dictamen oficial correspondiente a su trámite de solicitud de servicio de agua potable:
      </p>
      ${this.renderFichaDetalles(detalles)}
      ${mensajeResolucion}
    `;

    await this.transporter.sendMail({
      from:
        this.configService.get<string>('EMAIL_FROM') ??
        'no-reply@asada.local',
      to: destinatario,
      subject: `${this.nombreAsada} — Solicitud ${datos.codigo} ${
        esAprobada ? 'aprobada' : 'rechazada'
      }`,
      html: this.plantillaBase({
        titulo,
        cuerpoHtml,
        boton: esAprobada ? { texto: 'Ingresar al Portal de Abonados', url: urlDashboard } : undefined,
        avisoPie:
          'Agradecemos su interés y compromiso con la gestión hídrica comunal.',
      }),
    });
  }
}

