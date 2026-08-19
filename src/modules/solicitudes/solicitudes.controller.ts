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
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { SolicitudesService } from './solicitudes.service';
import { CreateSolicitudPajaAguaDto } from './dto/create-solicitud-paja-agua.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
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
@UseGuards(RolesGuard)
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  // Ruta pública: formulario web de solicitud de paja de agua
  @Public()
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'permisosMunicipales', maxCount: 1 },
        { name: 'cartaSolicitud', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (_req, _file, cb) => {
            const dir = join(process.cwd(), 'uploads', 'solicitudes');
            mkdirSync(dir, { recursive: true });
            cb(null, dir);
          },
          filename: (_req, file, cb) => {
            const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `${uniqueSuffix}${extname(safeName)}`);
          },
        }),
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
  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.solicitudesService.findAll();
  }
}
