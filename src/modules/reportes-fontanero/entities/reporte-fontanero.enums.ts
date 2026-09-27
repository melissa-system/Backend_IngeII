// Catálogo cerrado de actividades que puede reportar un fontanero. Está en un
// enum y no en texto libre para poder filtrar y contar por tipo desde el panel
// administrativo.
export enum TipoActividad {
  REPARACION = 'reparacion',
  INSTALACION = 'instalacion',
  MANTENIMIENTO = 'mantenimiento',
  ATENCION_AVERIA = 'atencion_averia',
  OTRO = 'otro',
}
