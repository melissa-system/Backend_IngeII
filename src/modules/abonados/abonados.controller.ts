import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AbonadosService } from './abonados.service';
import { CreateAbonadoDto } from './dto/create-abonado.dto';
import { UpdateAbonadoDto } from './dto/update-abonado.dto';
import { CambiarEstadoAbonadoDto } from './dto/cambiar-estado.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('abonados')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AbonadosController {
  constructor(private readonly abonadosService: AbonadosService) {}

  // Resumen personal del abonado logueado: datos personales, conteo de
  // solicitudes y averías, y las 5 más recientes de cada una.
  @Get('mi-resumen')
  @Roles(Role.ABONADO)
  obtenerMiResumen(@Request() req: { user?: RequestUser }) {
    return this.abonadosService.obtenerMiResumen(req.user!.id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() createAbonadoDto: CreateAbonadoDto) {
    return this.abonadosService.create(createAbonadoDto);
  }

  // Acepta ?buscar=<texto> para filtrar en el servidor por nombre/razón
  // social, cédula, número de abonado, teléfono o dirección.
  @Get()
  @Roles(Role.ADMIN)
  findAll(@Query('buscar') buscar?: string) {
    return this.abonadosService.findAll(buscar);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.abonadosService.findOne(id);
  }

  @Get(':id/historial')
  @Roles(Role.ADMIN)
  obtenerHistorial(@Param('id', ParseIntPipe) id: number) {
    return this.abonadosService.obtenerHistorial(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAbonadoDto: UpdateAbonadoDto,
    @Request() req: { user?: RequestUser },
  ) {
    return this.abonadosService.update(id, updateAbonadoDto, req.user?.id);
  }

  // Ruta específica para el cambio de estado operativo (Activo <-> Inactivo).
  // El cambio queda registrado en el historial con el usuario que lo hizo.
  @Patch(':id/estado')
  @Roles(Role.ADMIN)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoAbonadoDto,
    @Request() req: { user?: RequestUser },
  ) {
    return this.abonadosService.cambiarEstado(id, dto.estado, req.user?.id);
  }

  // Vincula (o crea) la cuenta de acceso del abonado por su correo. Si el
  // correo ya tiene usuario, solo enlaza; si no, crea la cuenta y manda el
  // correo de "define tu contraseña".
  @Post(':id/vincular-cuenta')
  @Roles(Role.ADMIN)
  vincularCuenta(@Param('id', ParseIntPipe) id: number) {
    return this.abonadosService.vincularCuenta(id);
  }
}