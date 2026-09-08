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
import { CambioRepresentanteService } from './solicitudes.cambio-representante.service';
import { CrearSolicitudCambioRepresentanteDto } from './dto/crear-solicitud-cambio-representante.dto';
import { ActualizarEstadoSolicitudDto } from './dto/actualizar-estado-solicitud.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

// Solicitudes de cambio de representante legal (solo abonados jurídicos).
// Accesible por administradores (que la crean para otros, las listan todas y
// gestionan el estado) y por abonados (que crean la suya y solo ven las
// propias — el filtro vive en el service).
@Controller('solicitudes/cambio-representante')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CambioRepresentanteController {
  constructor(
    private readonly cambioRepresentanteService: CambioRepresentanteService,
  ) {}

  // La foto o PDF de la cédula del nuevo representante viaja como
  // multipart/form-data en el campo "copiaCedula" (obligatoria).
  @Post()
  @Roles(Role.ADMIN, Role.ABONADO)
  @UseInterceptors(
    FileInterceptor('copiaCedula', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // Máx 5MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|pdf)$/)) {
          return cb(
            new BadRequestException(
              'Formato no válido. Solo se admiten fotos de la cédula (.jpg, .jpeg, .png) o .pdf',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  crear(
    @Body() dto: CrearSolicitudCambioRepresentanteDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: RequestUser },
  ) {
    if (!file) {
      throw new BadRequestException(
        'La foto o PDF de la cédula del nuevo representante es obligatoria',
      );
    }
    return this.cambioRepresentanteService.crear(dto, file, req.user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.ABONADO)
  listar(@Request() req: { user: RequestUser }) {
    return this.cambioRepresentanteService.listar(req.user);
  }

  // Cambio de estado. Al pasar a "aprobado" el backend actualiza los datos
  // del representante legal del abonado jurídico y notifica por correo al
  // abonado y al nuevo representante; al "rechazado" notifica con el motivo
  // opcional. Solo administradores.
  @Patch(':id/estado')
  @Roles(Role.ADMIN)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEstadoSolicitudDto,
    @Request() req: { user: RequestUser },
  ) {
    return this.cambioRepresentanteService.cambiarEstado(id, dto, req.user);
  }
}