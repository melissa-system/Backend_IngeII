import { Logger } from '@nestjs/common';

// Notificación por correo del resultado (aprobada / rechazada) de una
// solicitud. Es la misma lógica para los 6 tipos de trámite:
//
//  - Solo se notifica cuando el estado REALMENTE cambia a aprobado/rechazado
//    y todavía no se envió una notificación exitosa (sin duplicados).
//  - Antes de enviar se valida que el solicitante tenga un correo válido.
//  - El envío nunca bloquea el cambio de estado: cualquier error se captura
//    y queda registrado en la solicitud (notificacion_estado = 'fallida').
//  - Siempre queda trazabilidad en la solicitud: 'enviada', 'fallida' u
//    'omitida' (sin correo válido), con fecha y, si falló, el motivo.

export type EstadoNotificacion = 'enviada' | 'fallida' | 'omitida';

export interface ResultadoNotificacion {
  notificacion_estado: EstadoNotificacion;
  notificacion_fecha: Date;
  notificacion_error: string | null;
}

const ESTADOS_NOTIFICABLES = ['aprobado', 'rechazado', 'Aprobada', 'Rechazada'];
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LARGO_MAX_ERROR = 255;

const logger = new Logger('NotificacionSolicitud');

export function correoValido(correo?: string | null): correo is string {
  if (!correo) return false;
  const limpio = correo.trim();
  return limpio.length > 0 && limpio.length <= 254 && CORREO_REGEX.test(limpio);
}

/**
 * ¿Hay que notificar? Solo si el estado nuevo es aprobado/rechazado, es
 * distinto del anterior y no se envió ya una notificación exitosa.
 */
export function debeNotificar(
  estadoAnterior: string,
  estadoNuevo: string,
  notificacionPrevia?: string | null,
): boolean {
  return (
    ESTADOS_NOTIFICABLES.includes(estadoNuevo) &&
    estadoAnterior !== estadoNuevo &&
    notificacionPrevia !== 'enviada'
  );
}

/**
 * Envía la notificación y devuelve el resultado para registrarlo. Nunca lanza.
 */
export async function notificarResultado(opciones: {
  destinatario?: string | null;
  codigo: string;
  enviar: (destinatario: string) => Promise<void>;
}): Promise<ResultadoNotificacion> {
  const { destinatario, codigo, enviar } = opciones;
  const fecha = new Date();

  if (!correoValido(destinatario)) {
    logger.warn(
      `Solicitud ${codigo}: no se notificó porque el solicitante no tiene un correo válido.`,
    );
    return {
      notificacion_estado: 'omitida',
      notificacion_fecha: fecha,
      notificacion_error:
        'El solicitante no tiene un correo electrónico válido registrado',
    };
  }

  try {
    await enviar(destinatario.trim());
    return {
      notificacion_estado: 'enviada',
      notificacion_fecha: fecha,
      notificacion_error: null,
    };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    logger.error(`Solicitud ${codigo}: falló el envío del correo: ${mensaje}`);
    return {
      notificacion_estado: 'fallida',
      notificacion_fecha: fecha,
      notificacion_error: mensaje.slice(0, LARGO_MAX_ERROR),
    };
  }
}

/**
 * Guarda el resultado en la solicitud. También aislado: si falla guardar la
 * trazabilidad, el cambio de estado ya persistido no se ve afectado.
 */
export async function registrarNotificacion(
  repositorio: { update: (id: number, datos: any) => Promise<unknown> },
  id: number,
  resultado: ResultadoNotificacion,
): Promise<void> {
  try {
    await repositorio.update(id, resultado);
  } catch (error) {
    logger.error(
      `Solicitud ${id}: no se pudo registrar el resultado de la notificación: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
