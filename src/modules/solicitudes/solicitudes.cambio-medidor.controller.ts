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
import { SolicitudesCambioMedidorService } from './solicitudes.cambio-medidor.service';
import { CrearSolicitudCambioMedidorDto } from './dto/crear-solicitud-cambio-medidor.dto';
import { ActualizarEstadoSolicitudDto } from './dto/actualizar-estado-solicitud.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

// Solicitudes de cambio o reparación de medidor. Accesible por administradores
// y abonados (con filtro en el service para ver solo las propias).
@Controller('solicitudes/cambio-medidor')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SolicitudesCambioMedidorController {
  constructor(
    private readonly cambioMedidorService: SolicitudesCambioMedidorService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.ABONADO)
  @UseInterceptors(
    FileInterceptor('evidencia', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // Máx 5MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|pdf)$/)) {
          return cb(
            new BadRequestException(
              'Formato no válido. Solo se admiten fotos (.jpg, .jpeg, .png) o .pdf',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  crear(
    @Body() dto: CrearSolicitudCambioMedidorDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: RequestUser },
  ) {
    if (!file) {
      throw new BadRequestException(
        'La fotografía o evidencia del medidor es obligatoria',
      );
    }
    return this.cambioMedidorService.crear(dto, file, req.user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.ABONADO)
  listar(@Request() req: { user: RequestUser }) {
    return this.cambioMedidorService.listar(req.user);
  }

  @Patch(':id/estado')
  @Roles(Role.ADMIN)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEstadoSolicitudDto,
    @Request() req: { user: RequestUser },
  ) {
    return this.cambioMedidorService.cambiarEstado(id, dto, req.user);
  }
}
