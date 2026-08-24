import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AveriasService } from './averias.service';
import { CreateAveriaDto } from './dto/create-averia.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';

@Controller('averias')
export class AveriasController {
  constructor(private readonly averiasService: AveriasService) {}

  // Ruta pública: formulario web para reportar averías. Sin guards: JwtAuthGuard
  // no respeta @Public(), así que aquí no se aplica ninguno (a diferencia de
  // RolesGuard, que sí lo hacía).
  @Post()
  create(@Body() createAveriaDto: CreateAveriaDto) {
    return this.averiasService.create(createAveriaDto);
  }

  // Ruta protegida: consulta de todas las averías (solo Admin / Junta).
  // JwtAuthGuard corre primero (decodifica el token y llena request.user),
  // luego RolesGuard valida el rol.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.averiasService.findAll();
  }
}
