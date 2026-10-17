import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { AveriasService } from './averias.service';
import { CreateAveriaDto } from './dto/create-averia.dto';
import { UpdateAveriaDto } from './dto/update-averia.dto';
import { FiltroEstadisticasAveriasDto } from './dto/filtro-estadisticas-averias.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { ProtegidoConRecaptcha } from '../../common/recaptcha/recaptcha.decorator';

@Controller('averias')
export class AveriasController {
  constructor(private readonly averiasService: AveriasService) {}

  // Ruta pública: formulario de reporte de averías del landing. Protegida
  // con reCAPTCHA para que un bot no pueda inundar la ASADA de reportes
  // falsos (el token viaja en el encabezado X-Recaptcha-Token).
  @Post()
  @ProtegidoConRecaptcha()
  create(@Body() createAveriaDto: CreateAveriaDto) {
    return this.averiasService.create(createAveriaDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('mis-averias')
  @Roles(Role.ABONADO)
  misAverias(@Request() req: { user?: RequestUser }) {
    return this.averiasService.misAverias(req.user!);
  }

  // Bandeja del fontanero: solo las averías asignadas que siguen abiertas
  // (Pendiente o En proceso). Va antes de ':id' para no tomarse como un id.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('mis-averias-fontanero')
  @Roles(Role.FONTANERO)
  misAveriasFontanero(@Request() req: { user?: RequestUser }) {
    return this.averiasService.misAveriasFontanero(req.user!);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('estadisticas')
  @Roles(Role.ADMIN)
  obtenerEstadisticas(@Query() filtros: FiltroEstadisticasAveriasDto) {
    return this.averiasService.obtenerEstadisticas(filtros);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.averiasService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.averiasService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  @Roles(Role.ADMIN)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAveriaDto,
    @Request() req: { user?: RequestUser },
  ) {
    return this.averiasService.actualizar(id, dto, req.user?.id);
  }

  // El fontanero arranca el cronómetro de una avería asignada (la marca
  // "En proceso"). Solo puede hacerlo sobre sus propias averías.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/iniciar-gestion')
  @Roles(Role.FONTANERO)
  iniciarGestion(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: RequestUser },
  ) {
    return this.averiasService.iniciarGestion(id, req.user!);
  }

  // El fontanero detiene el cronómetro al terminar el trabajo. NO finaliza la
  // avería: al registrar el reporte queda "En revisión" y la administración
  // decide si se resuelve o no.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/terminar-gestion')
  @Roles(Role.FONTANERO)
  terminarGestion(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: RequestUser },
  ) {
    return this.averiasService.terminarGestion(id, req.user!);
  }
}
