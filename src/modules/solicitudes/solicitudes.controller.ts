import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SolicitudesService } from './solicitudes.service';
import { CreateSolicitudPajaAguaDto } from './dto/create-solicitud-paja-agua.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import {
  MIME_TYPES_PERMITIDOS,
  MIME_TYPES_FOTO_IDENTIFICACION,
  MENSAJE_FORMATO_NO_PERMITIDO,
  MENSAJE_FORMATO_FOTO_NO_PERMITIDO,
  mensajeTamanoExcedido,
} from '../../common/config/archivos-permitidos.config';

// Tamaño máximo permitido por archivo adjunto (5 MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Campos de archivo que son fotos de un documento de identidad: llevan una
// regla de formato más estricta que el resto (ver fileFilter abajo).
const CAMPOS_FOTO_IDENTIFICACION = ['cedulaFrente', 'cedulaDorso'];

@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  // Ruta pública: formulario web de solicitud de paja de agua. Sin guards:
  // JwtAuthGuard no respeta @Public(), así que aquí no se aplica ninguno.
  //
  // Los archivos se reciben en MEMORIA (memoryStorage) y el service los sube
  // a Cloudinary; ya no se escribe nada en el disco del servidor.
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'permisosMunicipales', maxCount: 1 },
        { name: 'cartaSolicitud', maxCount: 1 },
        { name: 'cedulaFrente', maxCount: 1 },
        { name: 'cedulaDorso', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter: (_req, file, cb) => {
          // La foto de la cédula (frente/dorso) tiene una regla más
          // estricta que el resto de adjuntos: no admite Word/Excel/PPT.
          const esFotoIdentificacion = CAMPOS_FOTO_IDENTIFICACION.includes(
            file.fieldname,
          );
          const permitidos = esFotoIdentificacion
            ? MIME_TYPES_FOTO_IDENTIFICACION
            : MIME_TYPES_PERMITIDOS;
          if (!permitidos.includes(file.mimetype)) {
            cb(
              new BadRequestException(
                esFotoIdentificacion
                  ? MENSAJE_FORMATO_FOTO_NO_PERMITIDO
                  : MENSAJE_FORMATO_NO_PERMITIDO,
              ),
              false,
            );
            return;
          }
          cb(null, true);
        },
      },
    ),
  )
  create(
    @Body() createSolicitudDto: CreateSolicitudPajaAguaDto,
    @UploadedFiles()
    files: {
      permisosMunicipales?: Express.Multer.File[];
      cartaSolicitud?: Express.Multer.File[];
      cedulaFrente?: Express.Multer.File[];
      cedulaDorso?: Express.Multer.File[];
    },
  ) {
    if (
      !files?.permisosMunicipales?.[0] ||
      !files?.cartaSolicitud?.[0] ||
      !files?.cedulaFrente?.[0] ||
      !files?.cedulaDorso?.[0]
    ) {
      throw new BadRequestException(
        'Debes adjuntar los permisos municipales, la carta de solicitud y la foto de la cédula por ambos lados',
      );
    }

    // Validación explícita de tamaño (aplica aunque un archivo haya superado el límite de multer)
    const adjuntos = [
      ...(files.permisosMunicipales ?? []),
      ...(files.cartaSolicitud ?? []),
      ...(files.cedulaFrente ?? []),
      ...(files.cedulaDorso ?? []),
    ];
    if (adjuntos.some((file) => file.size > MAX_FILE_SIZE)) {
      throw new BadRequestException(mensajeTamanoExcedido(MAX_FILE_SIZE));
    }

    return this.solicitudesService.create(createSolicitudDto, files);
  }

  // Ruta protegida: consulta de todas las solicitudes (solo Admin / Junta)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.solicitudesService.findAll();
  }
}