// Política anti fuerza bruta del login: máximo 5 intentos por IP cada
// 15 minutos. Valores compartidos entre auth.module.ts (que registra el
// ThrottlerModule) y auth.controller.ts (que decora la ruta login).

export const INTENTOS_LOGIN_MAXIMOS = 5;

// 15 minutos en milisegundos (desde @nestjs/throttler v5 el ttl va en ms).
export const VENTANA_MS = 15 * 60 * 1000;

export const POLITICA_LOGIN_THROTTLE = {
  default: { limit: INTENTOS_LOGIN_MAXIMOS, ttl: VENTANA_MS },
} as const;

// Política para /auth/reset-password/solicitar: máximo 3 solicitudes por IP
// cada 15 minutos. Más estricta que el login porque cada solicitud exitosa
// dispara un correo real (costo de envío) y es un vector típico de spam /
// enumeración de cuentas si no se limita.
export const INTENTOS_RESET_MAXIMOS = 3;
 
export const POLITICA_RESET_THROTTLE = {
  default: { limit: INTENTOS_RESET_MAXIMOS, ttl: VENTANA_MS },
} as const;
