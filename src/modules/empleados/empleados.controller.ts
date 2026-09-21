import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EmpleadosService } from './empleados.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('empleados')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  // Las rutas que modifican datos reciben el usuario autenticado para dejar
  // registrado en la bitácora quién hizo cada movimiento.
  //
  // La gestión de empleados es exclusiva de la Junta Directiva (SUPER_ADMIN);
  // por eso casi todos los endpoints están en Role.SUPER_ADMIN. La excepción
  // es GET /empleados (listado): se mantiene en Role.ADMIN porque la pantalla
  // de Averías del Administrador lo usa para mostrar los fontaneros
  // disponibles al asignar una avería.

  @Post()
  @Roles(Role.SUPER_ADMIN)
  crear(
    @Body() body: {
      nombre: string;
      cedula: string;
      puesto: string;
      telefono: string;
      fecha_ingreso: string;
      usuario_id?: number;
      email?: string;
      confirmarVinculacion?: boolean;
    },
    @Request() req: { user?: RequestUser },
  ) {
    return this.empleadosService.crear(body, req.user?.id);
  }

  @Get()
  @Roles(Role.ADMIN)
  buscar(@Query('buscar') buscar?: string) {
    return this.empleadosService.buscar(buscar);
  }

  @Get('usuarios')
  @Roles(Role.SUPER_ADMIN)
  listarUsuarios() {
    return this.empleadosService.listarUsuarios();
  }

  @Get('usuarios/por-email')
  @Roles(Role.SUPER_ADMIN)
  buscarUsuarioPorEmail(@Query('email') email: string) {
    return this.empleadosService.buscarUsuarioPorEmail(email);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.empleadosService.obtenerPorId(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: {
      nombre?: string;
      cedula?: string;
      puesto?: string;
      telefono?: string;
      correo?: string | null;
      fecha_ingreso?: string;
      usuario_id?: number | null;
      confirmarVinculacion?: boolean;
    },
    @Request() req: { user?: RequestUser },
  ) {
    return this.empleadosService.actualizar(id, body, req.user?.id);
  }

  @Patch(':id/estado')
  @Roles(Role.SUPER_ADMIN)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body('estado') estado: 'Activo' | 'Inactivo',
    @Request() req: { user?: RequestUser },
  ) {
    return this.empleadosService.cambiarEstado(id, estado, req.user?.id);
  }

  @Post(':id/vincular-cuenta')
  @Roles(Role.SUPER_ADMIN)
  vincularCuenta(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: RequestUser },
  ) {
    return this.empleadosService.vincularCuenta(id, req.user?.id);
  }
}