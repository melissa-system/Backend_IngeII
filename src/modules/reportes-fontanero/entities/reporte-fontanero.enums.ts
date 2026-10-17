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

// Estado de revisión del reporte por parte de la administración. La resolución
// de una avería NO la cierra el fontanero: al registrar el reporte queda
// "Pendiente" y es la administración quien la aprueba o rechaza.
export enum EstadoRevisionReporte {
  PENDIENTE = 'Pendiente',
  APROBADO = 'Aprobado',
  RECHAZADO = 'Rechazado',
}
