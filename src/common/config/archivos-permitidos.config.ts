import { BadRequestException } from '@nestjs/common';

// Regla de extensiones permitidas para CUALQUIER subida de archivo del
// sistema (pedido explícito de Meli): imágenes, Word, Excel, PDF y
// PowerPoint. Se restringe a propósito a solo estos formatos — permitir
// "todo" abriría la puerta a que suban archivos ejecutables u otros
// disfrazados con una extensión inofensiva.
//
// Este archivo es la fuente canónica de esa regla. Los módulos que ya
// tenían su propia lista de formatos (ej. documentos/documento-upload.config.ts)
// se pueden ir migrando a importar de acá sin cambiar su comportamiento actual;
// los módulos nuevos (ej. solicitudes) deben usar esto directamente.

export const MAX_TAMANO_ARCHIVO_DEFAULT = 10 * 1024 * 1024; // 10 MB

export const MIME_TYPES_PERMITIDOS = [
  // Imágenes
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // PDF
  'application/pdf',
  // Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

// Mismo criterio, mirado por extensión — útil para el <input accept="...">
// del frontend y como segunda verificación si algún día hace falta.
export const EXTENSIONES_PERMITIDAS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
];

export const MENSAJE_FORMATO_NO_PERMITIDO =
  'Solo se permiten imágenes, documentos Word, Excel, PowerPoint o PDF.';

export function mensajeTamanoExcedido(maxBytes: number): string {
  const mb = Math.round(maxBytes / (1024 * 1024));
  return `El archivo no puede superar los ${mb} MB`;
}

// fileFilter de multer: se ejecuta ANTES de que el archivo termine de
// recibirse, así que un formato rechazado ni siquiera llega a memoria completo.
export function multerFileFilterPermitido(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (!MIME_TYPES_PERMITIDOS.includes(file.mimetype)) {
    callback(new BadRequestException(MENSAJE_FORMATO_NO_PERMITIDO), false);
    return;
  }
  callback(null, true);
}

export function validarTamanoArchivo(
  archivo: Express.Multer.File | undefined,
  maxBytes: number = MAX_TAMANO_ARCHIVO_DEFAULT,
): void {
  if (archivo && archivo.size > maxBytes) {
    throw new BadRequestException(mensajeTamanoExcedido(maxBytes));
  }
}
