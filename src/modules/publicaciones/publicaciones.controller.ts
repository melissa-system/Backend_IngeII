import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { PublicacionesService } from './publicaciones.service';
import { CreatePublicacionDto } from './dto/create-publicacion.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller('publicaciones')
@UseGuards(RolesGuard)
export class PublicacionesController {
  constructor(private readonly publicacionesService: PublicacionesService) {}

  // NOTA: se deja @Public() temporalmente porque aún no existe autenticación
  // JWT real que llene request.user (ver RolesGuard). Cuando eso exista,
  // este endpoint debe pasar a @Roles(Role.ADMIN), igual que en abonados/averias.
  @Public()
  @Post()
  create(@Body() createPublicacionDto: CreatePublicacionDto) {
    return this.publicacionesService.create(createPublicacionDto);
  }

  // Ruta pública: consumida por el landing (solo publicaciones visibles)
  @Public()
  @Get()
  findPublicadas() {
    return this.publicacionesService.findPublicadas();
  }

  // Ruta para el dashboard administrativo (incluye borradores).
  // NOTA: también debería quedar @Roles(Role.ADMIN) una vez exista JWT real.
  @Public()
  @Get('todas')
  findAll() {
    return this.publicacionesService.findAll();
  }
}
