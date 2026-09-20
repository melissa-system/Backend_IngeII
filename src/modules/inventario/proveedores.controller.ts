import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { CrearProveedorDto } from './dto/crear-proveedor.dto';
import { ActualizarProveedorDto } from './dto/actualizar-proveedor.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';

@Controller(['api/proveedores', 'proveedores'])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ProveedoresController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Get()
  async listar() {
    return this.inventarioService.listarProveedores();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() dto: CrearProveedorDto) {
    return this.inventarioService.crearProveedor(dto);
  }

  @Patch(':id')
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarProveedorDto,
  ) {
    return this.inventarioService.actualizarProveedor(id, dto);
  }

  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.inventarioService.eliminarProveedor(id);
  }
}

