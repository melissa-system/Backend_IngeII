import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { CrearArticuloDto } from './dto/crear-articulo.dto';
import { ActualizarArticuloDto } from './dto/actualizar-articulo.dto';
import { RegistrarMovimientoDto } from './dto/registrar-movimiento.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller(['api/articulos', 'articulos'])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(
    @Body() dto: CrearArticuloDto,
    @Request() req: { user: RequestUser },
  ) {
    return this.inventarioService.crearArticulo(dto, req.user);
  }

  @Get()
  async listar(
    @Query('busqueda') busqueda?: string,
    @Query('clasificacion') clasificacion?: string,
    @Query('estado') estado?: string,
    @Query('soloStockBajo') soloStockBajo?: string,
  ) {
    return this.inventarioService.listarArticulos({
      busqueda,
      clasificacion,
      estado,
      soloStockBajo: soloStockBajo === 'true' || soloStockBajo === '1',
    });
  }

  @Get('movimientos')
  async listarMovimientos(
    @Query('tipo') tipo?: string,
    @Query('busqueda') busqueda?: string,
  ) {
    return this.inventarioService.listarTodosLosMovimientos({ tipo, busqueda });
  }

  @Get(':id')
  async obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.inventarioService.obtenerArticuloPorId(id);
  }

  @Patch(':id')
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarArticuloDto,
    @Request() req: { user: RequestUser },
  ) {
    return this.inventarioService.actualizarArticulo(id, dto, req.user);
  }

  @Put(':id/movimiento')
  async registrarMovimiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistrarMovimientoDto,
    @Request() req: { user: RequestUser },
  ) {
    return this.inventarioService.registrarMovimiento(id, dto, req.user);
  }

  @Get(':id/historial')
  async obtenerHistorial(@Param('id', ParseIntPipe) id: number) {
    return this.inventarioService.obtenerHistorialArticulo(id);
  }

  @Patch(':id/estado')
  async cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: RequestUser },
    @Body('estado') nuevoEstado?: 'activo' | 'inactivo',
  ) {
    return this.inventarioService.cambiarEstado(id, req.user, nuevoEstado);
  }
}