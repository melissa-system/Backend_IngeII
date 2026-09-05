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

// Tamaño máximo permitido por archivo adjunto (5 MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Tipos MIME permitidos: imágenes y PDF
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

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
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter: (_req, file, cb) => {
          if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(
              new BadRequestException(
                'Solo se permiten archivos de imagen (JPG, PNG, GIF, WEBP) o PDF',
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
    },
  ) {
    if (!files?.permisosMunicipales?.[0] || !files?.cartaSolicitud?.[0]) {
      throw new BadRequestException(
        'Debes adjuntar los permisos municipales y la carta de solicitud',
      );
    }

    // Validación explícita de tamaño (aplica aunque un archivo haya superado el límite de multer)
    const adjuntos = [
      ...(files.permisosMunicipales ?? []),
      ...(files.cartaSolicitud ?? []),
    ];
    if (adjuntos.some((file) => file.size > MAX_FILE_SIZE)) {
      throw new BadRequestException(
        'Los archivos adjuntos no pueden superar los 5 MB',
      );
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