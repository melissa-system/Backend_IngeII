import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';

@Controller('inventario')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventarioController {

  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return { message: 'Listado de inventario obtenido correctamente' };
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() data: any) {
    return { message: 'Artículo registrado en inventario' };
  }
}