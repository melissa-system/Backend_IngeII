// Módulos del sistema que pueden registrar movimientos en la bitácora.
// Al agregar un módulo nuevo (ej. inventario cuando se trabaje), basta con
// sumarlo acá — no hay que crear ninguna tabla ni entidad adicional.
export enum ModuloBitacora {
  ABONADOS = 'abonados',
  SOLICITUDES = 'solicitudes',
  AVERIAS = 'averias',
  INVENTARIO = 'inventario',
  USUARIOS = 'usuarios',
  EMPLEADOS = 'empleados',
  DOCUMENTOS = 'documentos',
  PUBLICACIONES = 'publicaciones',
  CONFIGURACION = 'configuracion',
}

// Tipo de movimiento registrado.
//
// CAMBIO_ESTADO se separa de EDICION a propósito: aunque técnicamente un
// cambio de estado es una edición de campo, en la operación diaria de la
// ASADA es la acción que más se consulta (¿quién aprobó esta solicitud?,
// ¿cuándo se cerró esta avería?). Tenerla como acción propia permite
// filtrarla sin depender del nombre del campo.
export enum AccionBitacora {
  CREACION = 'creacion',
  EDICION = 'edicion',
  CAMBIO_ESTADO = 'cambio_estado',
  ELIMINACION = 'eliminacion',
}