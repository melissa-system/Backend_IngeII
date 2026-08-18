import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AveriasService } from './averias.service';
import { CreateAveriaDto } from './dto/create-averia.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Role } from '../../common/enums/roles.enum';

@Controller('averias')
@UseGuards(RolesGuard)
export class AveriasController {
  constructor(private readonly averiasService: AveriasService) {}

  // Ruta pública: formulario web para reportar averías
  @Public()
  @Post()
  create(@Body() createAveriaDto: CreateAveriaDto) {
    return this.averiasService.create(createAveriaDto);
  }

  // Ruta protegida: consulta de todas las averías (solo Admin / Junta)
  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.averiasService.findAll();
  }
}
