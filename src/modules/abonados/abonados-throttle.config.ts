// Política anti doble-clic para POST /abonados/:id/reenviar-acceso: máximo
// 1 solicitud por IP cada 15 segundos. No es una protección anti fuerza
// bruta (eso ya lo cubre el propio JwtAuthGuard + rol Administrador), sino
// evitar que un clic repetido en el botón dispare varios correos duplicados
// y sature el envío (SMTP) o el reset-password-token del mismo usuario.
export const POLITICA_REENVIO_ACCESO_THROTTLE = {
  default: { limit: 1, ttl: 15 * 1000 },
} as const;
