import { LaborAdicional } from '../../labores-adicionales/entities/labor-adicional.entity';

// Resumen de la labor generada al aprobar una solicitud. Se incluye en las
// respuestas de las solicitudes para que la administración vea en qué va el
// trabajo operativo (asignación, reporte, cierre) sin abrir "Otros
// mantenimientos".
export interface LaborDeSolicitud {
  id: number;
  codigo_labor: string;
  estado: string;
}

export function resumirLabor(
  labor: LaborAdicional | null | undefined,
): LaborDeSolicitud | null {
  if (!labor) return null;
  return {
    id: labor.id,
    codigo_labor: labor.codigo_labor,
    estado: labor.estado,
  };
}
