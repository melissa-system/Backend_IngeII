import { BadRequestException } from '@nestjs/common';

// Reglas de formato y tamaño para cualquier archivo de documento (carga
// inicial o nueva versión) — un solo lugar para las dos rutas del
// controlador que reciben un archivo, y para los tests que las verifican.
// Los valores respetan el máximo de 10 MB por archivo (imagen o raw) del
// plan gratuito de Cloudinary.

export const MAX_DOCUMENTO_FILE_SIZE = 10 * 1024 * 1024;

export const ALLOWED_DOCUMENTO_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
];

export const MENSAJE_FORMATO_NO_PERMITIDO =
  'Solo se permiten archivos PDF, Word, Excel o imágenes (JPG, PNG)';

export const MENSAJE_TAMANO_EXCEDIDO = 'El archivo no puede superar los 10 MB';

// fileFilter de multer: se ejecuta ANTES de que el archivo termine de
// recibirse, así que un formato rechazado ni siquiera llega a memoria
// completo.
export function multerFileFilterDocumento(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (!ALLOWED_DOCUMENTO_MIME_TYPES.includes(file.mimetype)) {
    callback(new BadRequestException(MENSAJE_FORMATO_NO_PERMITIDO), false);
    return;
  }
  callback(null, true);
}

// Revalidación explícita de tamaño en el controller: limits.fileSize de
// multer no siempre resulta en un mensaje claro para quien sube el archivo
// (puede llegar como un error crudo en vez de un 400 con texto entendible).
export function validarTamanoDocumento(
  archivo?: Express.Multer.File,
): void {
  if (archivo && archivo.size > MAX_DOCUMENTO_FILE_SIZE) {
    throw new BadRequestException(MENSAJE_TAMANO_EXCEDIDO);
  }
}
