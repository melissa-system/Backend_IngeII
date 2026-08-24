export class UpdateDocumentoDto {
  nombre?: string;
  visibilidad?: string; // 'Público' | 'Interno'
  estado?: string; // 'Vigente' | 'Inhabilitado' — permite inhabilitar/reactivar manualmente
}
