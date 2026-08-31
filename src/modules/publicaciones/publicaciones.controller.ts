import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PublicacionesService } from './publicaciones.service';
import { CreatePublicacionDto } from './dto/create-publicacion.dto';
import { UpdatePublicacionDto } from './dto/update-publicacion.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('publicaciones')
export class PublicacionesController {
  constructor(private readonly publicacionesService: PublicacionesService) {}

  // Ya existe JWT real (ver auth.module.ts): las NOTA anteriores que decían
  // "dejar @Public() hasta que exista JWT" quedaron desactualizadas. Ahora
  // que se agrega autor_id, hace falta req.user de todos modos para saber
  // quién crea la publicación, así que de paso se cierra este hueco.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(
    @Body() createPublicacionDto: CreatePublicacionDto,
    @Request() req: { user?: RequestUser },
  ) {
    return this.publicacionesService.create(createPublicacionDto, req.user?.id);
  }

  // Ruta pública: consumida por el landing (solo publicaciones visibles)
  @Public()
  @Get()
  findPublicadas() {
    return this.publicacionesService.findPublicadas();
  }

  // Ruta para el dashboard administrativo (incluye borradores).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('todas')
  findAll() {
    return this.publicacionesService.findAll();
  }

  // Edición y publicar/despublicar, usado por el dashboard administrativo.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePublicacionDto: UpdatePublicacionDto,
  ) {
    return this.publicacionesService.update(id, updatePublicacionDto);
  }
}
