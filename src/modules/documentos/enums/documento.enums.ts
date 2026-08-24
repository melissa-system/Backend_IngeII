// Catálogo cerrado de tipos de documento. Todo documento que se cargue debe
// clasificarse en una de estas categorías (ver Documento.tipo y la validación
// en documentos.service.ts). Si se necesita un tipo nuevo, se agrega acá.
export enum TipoDocumento {
  ACTA = 'Actas',
  INFORME = 'Informes',
  MEDICION_ACUEDUCTO = 'Mediciones en el acueducto',
  COMUNICADO = 'Comunicados',
  OTRO = 'Otros',
}

// Controla quién puede ver el documento.
// Público: visible para cualquier persona (ej. en una futura sección de
// documentos del landing). Interno: solo visible desde el dashboard
// administrativo.
export enum VisibilidadDocumento {
  PUBLICO = 'Público',
  INTERNO = 'Interno',
}

// Controla si el documento es la versión activa o fue reemplazada/dada de baja.
// Vigente: es la versión actual. Inhabilitado: versión anterior conservada
// solo para historial, o documento dado de baja manualmente.
export enum EstadoDocumento {
  VIGENTE = 'Vigente',
  INHABILITADO = 'Inhabilitado',
}
