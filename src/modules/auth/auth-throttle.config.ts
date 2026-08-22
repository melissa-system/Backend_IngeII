// Política anti fuerza bruta del login: máximo 5 intentos por IP cada
// 15 minutos. Valores compartidos entre auth.module.ts (que registra el
// ThrottlerModule) y auth.controller.ts (que decora la ruta login).

export const INTENTOS_LOGIN_MAXIMOS = 5;

// 15 minutos en milisegundos (desde @nestjs/throttler v5 el ttl va en ms).
export const VENTANA_MS = 15 * 60 * 1000;

export const POLITICA_LOGIN_THROTTLE = {
  default: { limit: INTENTOS_LOGIN_MAXIMOS, ttl: VENTANA_MS },
} as const;
