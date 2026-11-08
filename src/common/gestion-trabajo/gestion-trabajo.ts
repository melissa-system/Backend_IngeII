// Lógica compartida de gestión (cronómetro) y revisión para los "trabajos" que
// atiende un fontanero: averías y labores adicionales. Ambas entidades tienen
// los mismos campos de gestión, así que las reglas viven en un solo lugar.

export interface TrabajoGestionable {
  estado: string;
  gestion_iniciada_en: Date | null;
  gestion_finalizada_en: Date | null;
  devuelta_revision: boolean;
  motivo_revision: string | null;
}

export const ESTADOS_TRABAJO = [
  'Pendiente',
  'En proceso',
  'En revisión',
  'Finalizado',
] as const;

export const MOTIVO_RECHAZO_POR_DEFECTO =
  'La administración rechazó la resolución. Vuelve a atender el trabajo.';

// Duración en minutos entre dos marcas, acotada a 1–1440 (el tope de 24 h del
// reporte). Devuelve 0 si falta alguna marca.
export function calcularDuracionMinutos(
  inicio: Date | null,
  fin: Date | null,
): number {
  if (!inicio || !fin) return 0;
  const ms = fin.getTime() - inicio.getTime();
  if (ms <= 0) return 0;
  return Math.min(1440, Math.max(1, Math.round(ms / 60000)));
}

// Marca el inicio de la gestión. Si ya había una gestión terminada sin reportar,
// la reinicia. Limpia la marca de "devuelta".
export function aplicarInicioGestion(trabajo: TrabajoGestionable): void {
  if (!trabajo.gestion_iniciada_en || trabajo.gestion_finalizada_en) {
    trabajo.gestion_iniciada_en = new Date();
    trabajo.gestion_finalizada_en = null;
  }
  trabajo.devuelta_revision = false;
  trabajo.motivo_revision = null;
  trabajo.estado = 'En proceso';
}

// Detiene el cronómetro (si no estaba detenido).
export function aplicarTerminoGestion(trabajo: TrabajoGestionable): void {
  if (!trabajo.gestion_finalizada_en) {
    trabajo.gestion_finalizada_en = new Date();
  }
}

// El fontanero registró el reporte: el trabajo queda a revisión de la
// administración (ya no está "devuelto") y el cronómetro queda detenido.
export function aplicarEnvioRevision(trabajo: TrabajoGestionable): void {
  trabajo.estado = 'En revisión';
  trabajo.devuelta_revision = false;
  trabajo.motivo_revision = null;
  if (!trabajo.gestion_finalizada_en) {
    trabajo.gestion_finalizada_en = new Date();
  }
}

// Aplica la decisión de la administración: aprobar finaliza; rechazar devuelve
// el trabajo al fontanero y limpia el cronómetro para que lo reinicie.
export function aplicarRevision(
  trabajo: TrabajoGestionable,
  aprobado: boolean,
  motivo?: string | null,
): void {
  if (aprobado) {
    trabajo.estado = 'Finalizado';
    trabajo.devuelta_revision = false;
    trabajo.motivo_revision = null;
    if (!trabajo.gestion_finalizada_en) {
      trabajo.gestion_finalizada_en = new Date();
    }
  } else {
    trabajo.estado = 'En proceso';
    trabajo.gestion_iniciada_en = null;
    trabajo.gestion_finalizada_en = null;
    trabajo.devuelta_revision = true;
    trabajo.motivo_revision = motivo?.trim() || MOTIVO_RECHAZO_POR_DEFECTO;
  }
}
