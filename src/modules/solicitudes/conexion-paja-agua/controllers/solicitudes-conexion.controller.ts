import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SolicitudesConexionService } from '../services/solicitudes-conexion.service';
import { CrearSolicitudConexionDto } from '../dto/crear-solicitud-conexion.dto';
import { ActualizarEstadoSolicitudDto } from '../../common/dto/actualizar-estado-solicitud.dto';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { Role } from '../../../../common/enums/roles.enum';
import type { RequestUser } from '../../../auth/strategies/jwt.strategy';
import {
  MAX_TAMANO_ARCHIVO_DEFAULT,
  multerFileFilterPermitido,
} from '../../../../common/config/archivos-permitidos.config';

// Documento firmado que se adjunta al aprobar: PDF o Word.
const MIME_TYPES_DOCUMENTO_APROBACION = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Segunda parte del trámite de paja de agua: la Solicitud de conexión de
// servicio (formulario GNU-42-01-F1), disponible en el dashboard del Abonado
// solo una vez que su solicitud original quedó Aprobada.
@Controller('solicitudes/conexion-paja-agua')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SolicitudesConexionController {
  constructor(private readonly service: SolicitudesConexionService) {}

  // Solicitudes de paja de agua aprobadas del abonado autenticado que aún no
  // tienen una solicitud de conexión — el frontend las usa para decidir si
  // mostrar la página y para precargar el formulario.
  @Get('disponibles')
  @Roles(Role.ABONADO)
  disponibles(@Request() req: { user: RequestUser }) {
    return this.service.solicitudesDisponibles(req.user);
  }

  @Post()
  @Roles(Role.ABONADO)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'firma', maxCount: 1 },
        { name: 'adjuntos', maxCount: 10 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: MAX_TAMANO_ARCHIVO_DEFAULT },
        fileFilter: multerFileFilterPermitido,
      },
    ),
  )
  crear(
    @Body() dto: CrearSolicitudConexionDto,
    @UploadedFiles()
    files: {
      firma?: Express.Multer.File[];
      adjuntos?: Express.Multer.File[];
    },
    @Request() req: { user: RequestUser },
  ) {
    return this.service.crear(dto, files, req.user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.ABONADO)
  listar(@Request() req: { user: RequestUser }) {
    return this.service.listar(req.user);
  }

  // Al aprobar, el administrador/junta adjunta el documento de aprobación
  // firmado por la ASADA (obligatorio); se envía por correo al solicitante.
  @Patch(':id/estado')
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('documentoAprobacion', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_TAMANO_ARCHIVO_DEFAULT },
      fileFilter: (_req, file, cb) => {
        if (!MIME_TYPES_DOCUMENTO_APROBACION.includes(file.mimetype)) {
          cb(
            new BadRequestException(
              'El documento de aprobación debe ser un PDF o un archivo de Word',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEstadoSolicitudDto,
    @Request() req: { user: RequestUser },
    @UploadedFile() documentoAprobacion?: Express.Multer.File,
  ) {
    return this.service.cambiarEstado(id, dto, req.user, documentoAprobacion);
  }
}
