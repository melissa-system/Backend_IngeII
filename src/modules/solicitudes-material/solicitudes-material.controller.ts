import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SolicitudesMaterialService } from './solicitudes-material.service';
import {
  CrearSolicitudMaterialDto,
  VincularMaterialDto,
} from './dto/crear-solicitud-material.dto';
import { RechazarSolicitudMaterialDto } from './dto/rechazar-solicitud-material.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

// Pedidos de materiales que hace el fontanero antes de atender un trabajo.
// El fontanero crea y consulta los suyos; la administración y la Junta
// Directiva (acceso total) revisan, vinculan y aprueban.
@Controller('solicitudes-material')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SolicitudesMaterialController {
  constructor(private readonly service: SolicitudesMaterialService) {}

  // Catálogo reducido para el formulario del fontanero (no expone el módulo
  // completo de inventario, que es solo de administración).
  @Get('catalogo')
  @Roles(Role.FONTANERO)
  catalogo() {
    return this.service.catalogo();
  }

  // Bandeja del fontanero. Va antes de ':id' para no interpretarse como id.
  @Get('mis-solicitudes')
  @Roles(Role.FONTANERO)
  misSolicitudes(@Request() req: { user: RequestUser }) {
    return this.service.misSolicitudes(req.user);
  }

  @Get()
  @Roles(Role.ADMIN)
  listar(
    @Query('estado') estado?: string,
    @Query('busqueda') busqueda?: string,
  ) {
    return this.service.listar({ estado, busqueda });
  }

  @Post()
  @Roles(Role.FONTANERO)
  crear(
    @Body() dto: CrearSolicitudMaterialDto,
    @Request() req: { user: RequestUser },
  ) {
    return this.service.crear(dto, req.user);
  }

  @Patch(':id/vincular/:detalleId')
  @Roles(Role.ADMIN)
  vincular(
    @Param('id', ParseIntPipe) id: number,
    @Param('detalleId', ParseIntPipe) detalleId: number,
    @Body() dto: VincularMaterialDto,
    @Request() req: { user: RequestUser },
  ) {
    return this.service.vincularDetalle(
      id,
      detalleId,
      dto.articuloId,
      req.user,
    );
  }

  @Patch(':id/aprobar')
  @Roles(Role.ADMIN)
  aprobar(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: RequestUser },
  ) {
    return this.service.aprobar(id, req.user);
  }

  @Patch(':id/rechazar')
  @Roles(Role.ADMIN)
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RechazarSolicitudMaterialDto,
    @Request() req: { user: RequestUser },
  ) {
    return this.service.rechazar(id, dto, req.user);
  }

  @Patch(':id/cancelar')
  @Roles(Role.FONTANERO)
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: RequestUser },
  ) {
    return this.service.cancelar(id, req.user);
  }
}
