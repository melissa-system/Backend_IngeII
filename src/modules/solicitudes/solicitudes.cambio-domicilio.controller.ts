import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CambioDomicilioService } from './solicitudes.cambio-domicilio.service';
import { CrearSolicitudCambioDomicilioDto } from './dto/crear-solicitud-cambio-domicilio.dto';
import { ActualizarEstadoSolicitudDto } from './dto/actualizar-estado-solicitud.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

// Solicitudes de cambio de domicilio. Accesible por administradores (que la
// crean para otros, las listan todas y gestionan el estado) y por abonados
// (que crean la suya y solo ven las propias — el filtro vive en el service).
@Controller('solicitudes/cambio-domicilio')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CambioDomicilioController {
  constructor(
    private readonly cambioDomicilioService: CambioDomicilioService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.ABONADO)
  crear(
    @Body() dto: CrearSolicitudCambioDomicilioDto,
    @Request() req: { user: RequestUser },
  ) {
    return this.cambioDomicilioService.crear(dto, req.user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.ABONADO)
  listar(@Request() req: { user: RequestUser }) {
    return this.cambioDomicilioService.listar(req.user);
  }

  // Cambio de estado. Al pasar a "aprobado" el backend actualiza la
  // dirección del abonado y notifica por correo; al "rechazado" notifica con
  // el motivo opcional. Solo administradores.
  @Patch(':id/estado')
  @Roles(Role.ADMIN)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEstadoSolicitudDto,
    @Request() req: { user: RequestUser },
  ) {
    return this.cambioDomicilioService.cambiarEstado(id, dto, req.user);
  }
}