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
} from '@nestjs/common';
import { EmpleadosService } from './empleados.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';

@Controller('empleados')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  @Post()
  @Roles(Role.ADMIN)
  crear(@Body() body: {
    nombre: string;
    cedula: string;
    puesto: string;
    telefono: string;
    fecha_ingreso: string;
    usuario_id?: number;
    email?: string;
  }) {
    return this.empleadosService.crear(body);
  }

  @Get()
  @Roles(Role.ADMIN)
  buscar(@Query('buscar') buscar?: string) {
    return this.empleadosService.buscar(buscar);
  }

  @Get('usuarios')
  @Roles(Role.ADMIN)
  listarUsuarios() {
    return this.empleadosService.listarUsuarios();
  }

  @Get('usuarios/por-email')
  @Roles(Role.ADMIN)
  buscarUsuarioPorEmail(@Query('email') email: string) {
    return this.empleadosService.buscarUsuarioPorEmail(email);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.empleadosService.obtenerPorId(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
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
    },
  ) {
    return this.empleadosService.actualizar(id, body);
  }

  @Patch(':id/estado')
  @Roles(Role.ADMIN)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body('estado') estado: 'Activo' | 'Inactivo',
  ) {
    return this.empleadosService.cambiarEstado(id, estado);
  }
}
