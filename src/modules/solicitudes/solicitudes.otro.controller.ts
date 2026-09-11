import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SolicitudesOtroService } from './solicitudes.otro.service';
import { CrearSolicitudOtroDto } from './dto/crear-solicitud-otro.dto';
import { ActualizarEstadoSolicitudOtroDto } from './dto/actualizar-estado-solicitud-otro.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

// Solicitudes de trámite "otro": una categoría abierta para lo que no encaja
// en los tipos predefinidos. Accesible por administradores (que la crean para
// otros, las listan todas y gestionan el estado) y por abonados (que crean la
// suya y solo ven las propias — el filtro vive en el service).
@Controller('solicitudes/otro')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SolicitudesOtroController {
  constructor(
    private readonly otroService: SolicitudesOtroService,
  ) {}

  // El archivo de soporte viaja como multipart/form-data en el campo
  // "adjunto" y es OPCIONAL: está bien crear el trámite solo con asunto y
  // justificación.
  @Post()
  @Roles(Role.ADMIN, Role.ABONADO)
  @UseInterceptors(
    FileInterceptor('adjunto', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // Máx 5MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|pdf)$/)) {
          return cb(
            new BadRequestException(
              'Formato no válido. Solo se admiten imágenes (.jpg, .jpeg, .png) o .pdf',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  crear(
    @Body() dto: CrearSolicitudOtroDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: RequestUser },
  ) {
    return this.otroService.crear(dto, file, req.user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.ABONADO)
  listar(@Request() req: { user: RequestUser }) {
    return this.otroService.listar(req.user);
  }

  // Cambio de estado. Al aprobar o rechazar es obligatorio un comentario del
  // administrador (se valida en el DTO), que queda documentado y se envía por
  // correo. Este tipo no actualiza datos del abonado. Solo administradores.
  @Patch(':id/estado')
  @Roles(Role.ADMIN)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEstadoSolicitudOtroDto,
    @Request() req: { user: RequestUser },
  ) {
    return this.otroService.cambiarEstado(id, dto, req.user);
  }
}