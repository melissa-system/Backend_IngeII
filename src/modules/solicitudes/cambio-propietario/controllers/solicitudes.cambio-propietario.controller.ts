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
import { SolicitudesCambioPropietarioService } from '../services/solicitudes.cambio-propietario.service';
import { CrearSolicitudCambioPropietarioDto } from '../dto/crear-solicitud-cambio-propietario.dto';
import { ActualizarEstadoSolicitudDto } from '../../common/dto/actualizar-estado-solicitud.dto';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { Role } from '../../../../common/enums/roles.enum';
import type { RequestUser } from '../../../auth/strategies/jwt.strategy';

@Controller('solicitudes/cambio-propietario')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SolicitudesCambioPropietarioController {
  constructor(
    private readonly cambioPropietarioService: SolicitudesCambioPropietarioService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.ABONADO)
  @UseInterceptors(
    FileInterceptor('documento_soporte', {
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
  async crear(
    @Body() dto: CrearSolicitudCambioPropietarioDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: RequestUser },
  ) {
    if (!file) {
      throw new BadRequestException(
        'El documento legal de soporte (escritura o certificación) es obligatorio',
      );
    }
    return this.cambioPropietarioService.crear(dto, file, req.user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.ABONADO)
  listar(@Request() req: { user: RequestUser }) {
    return this.cambioPropietarioService.listar(req.user);
  }

  @Patch(':id/estado')
  @Roles(Role.ADMIN)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEstadoSolicitudDto,
    @Request() req: { user: RequestUser },
  ) {
    return this.cambioPropietarioService.cambiarEstado(id, dto, req.user);
  }
}
