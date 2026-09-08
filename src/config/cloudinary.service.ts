import {
  Injectable,
  Inject,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { v2 as CloudinaryType, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';
import { extname } from 'path';
import { CLOUDINARY } from './cloudinary.provider';

// Resultado de una subida: es lo único que los módulos necesitan guardar en
// la base de datos. El public_id hace falta para poder borrar el archivo
// después (ver eliminarArchivo).
export interface ArchivoSubido {
  url: string;
  publicId: string;
}

// Tipos MIME permitidos en todo el sistema: imágenes, PDF y Word.
const TIPOS_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Tamaño máximo por archivo (10 MB). Cada módulo puede exigir menos si lo
// necesita, pero nunca más que esto.
const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024;

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(
    @Inject(CLOUDINARY)
    private readonly cloudinary: typeof CloudinaryType,
  ) {}

  // Sube un archivo recibido en memoria (buffer) a Cloudinary y devuelve la
  // URL segura y el public_id. La carpeta agrupa los archivos dentro de la
  // cuenta (ej: 'ASADA/solicitudes', 'ASADA/usuarios') para poder ubicarlos
  // desde el panel de Cloudinary sin adivinar.
  async subirArchivo(
    archivo: Express.Multer.File,
    carpeta: string,
  ): Promise<ArchivoSubido> {
    this.validarArchivo(archivo);

    // Cloudinary distingue entre imágenes y "raw" (todo lo demás). Los PDF y
    // los Word deben subirse como 'raw'; si se dejan en 'auto' el SDK a veces
    // los clasifica mal y luego la URL no resuelve.
    const esImagen = archivo.mimetype.startsWith('image/');
    const resourceType: 'image' | 'raw' = esImagen ? 'image' : 'raw';

    // IMPORTANTE (archivos 'raw'): Cloudinary NO agrega la extensión al
    // public_id de un archivo raw. Si no se incluye a mano, la URL termina
    // sin extensión (.../ASADA/documentos/a1b2c3) y al descargarlo el sistema
    // operativo no sabe con qué abrirlo: pregunta por una aplicación y, al
    // abrirlo con un editor de texto, muestra el código fuente crudo del PDF
    // en vez del documento. Por eso el public_id se arma con el nombre
    // original + un sufijo único + la extensión.
    //
    // Las imágenes no necesitan esto: Cloudinary les asigna el formato solo.
    const publicId = esImagen
      ? undefined
      : this.construirPublicId(archivo.originalname);

    try {
      const resultado = await new Promise<UploadApiResponse>(
        (resolve, reject) => {
          const uploadStream = this.cloudinary.uploader.upload_stream(
            {
              folder: carpeta,
              resource_type: resourceType,
              ...(publicId ? { public_id: publicId } : {}),
            },
            (error, result) => {
              if (error) return reject(error);
              if (!result) {
                return reject(new Error('Cloudinary no devolvió resultado'));
              }
              resolve(result);
            },
          );

          streamifier.createReadStream(archivo.buffer).pipe(uploadStream);
        },
      );

      return {
        url: resultado.secure_url,
        publicId: resultado.public_id,
      };
    } catch (error) {
      // El detalle del error queda en los logs del servidor; al cliente solo
      // le llega un mensaje genérico, para no exponer nada de la cuenta.
      this.logger.error('Error al subir archivo a Cloudinary', error as Error);
      throw new InternalServerErrorException(
        'No se pudo subir el archivo. Intenta de nuevo más tarde.',
      );
    }
  }

  // Elimina un archivo de Cloudinary. Se usa al reemplazar un archivo por una
  // versión nueva, y como rollback si falla el guardado en base de datos.
  //
  // Es tolerante a fallos a propósito: si el borrado falla (el archivo ya no
  // existe, error de red...), se registra pero NO se lanza excepción. Quien
  // llama a este método ya guardó el archivo nuevo con éxito; tumbar toda la
  // operación por no poder borrar el viejo dejaría al usuario sin su cambio.
  async eliminarArchivo(
    publicId: string,
    esImagen = true,
  ): Promise<void> {
    if (!publicId) return;

    try {
      await this.cloudinary.uploader.destroy(publicId, {
        resource_type: esImagen ? 'image' : 'raw',
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo eliminar el archivo ${publicId} de Cloudinary`,
        error as Error,
      );
    }
  }

  // Arma un public_id legible y único que CONSERVA la extensión original.
  // Ej: "Acta de asamblea.pdf" -> "Acta_de_asamblea_1788632472540.pdf"
  //
  // El nombre se limpia de caracteres que Cloudinary no admite en un
  // public_id (espacios, acentos, símbolos), y se le agrega la marca de
  // tiempo para que dos archivos con el mismo nombre no se sobrescriban.
  private construirPublicId(nombreOriginal: string): string {
    const extension = extname(nombreOriginal); // incluye el punto: '.pdf'
    const base = nombreOriginal
      .slice(0, nombreOriginal.length - extension.length)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // quita acentos
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80); // evita public_ids desmedidos

    return `${base || 'archivo'}_${Date.now()}${extension}`;
  }

  // Validaciones comunes a cualquier subida del sistema.
  private validarArchivo(archivo: Express.Multer.File): void {
    if (!archivo) {
      throw new BadRequestException('Debes adjuntar un archivo');
    }

    // Con memoryStorage el archivo llega en .buffer; si no está, es señal de
    // que el módulo que llama todavía usa diskStorage.
    if (!archivo.buffer) {
      throw new BadRequestException(
        'El archivo no se recibió correctamente en memoria',
      );
    }

    if (!TIPOS_PERMITIDOS.includes(archivo.mimetype)) {
      throw new BadRequestException(
        'Solo se permiten imágenes (JPG, PNG, GIF, WEBP), PDF o Word',
      );
    }

    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      throw new BadRequestException(
        `El archivo supera el tamaño máximo permitido (${TAMANO_MAXIMO_BYTES / 1024 / 1024} MB)`,
      );
    }
  }
}