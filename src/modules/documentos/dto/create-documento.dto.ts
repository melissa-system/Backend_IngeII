export class CreateDocumentoDto {
  nombre: string;
  tipo: string; // debe ser uno de los valores del catálogo TipoDocumento (ver enums/documento.enums.ts)
  visibilidad?: string; // 'Público' | 'Interno', opcional, por defecto 'Interno'
}
