import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SolicitudesEstadisticasService } from '../services/solicitudes-estadisticas.service';
import { FiltroEstadisticasSolicitudesDto } from '../dto/filtro-estadisticas-solicitudes.dto';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { Role } from '../../../../common/enums/roles.enum';

// Endpoint de estadísticas de solicitudes para la página de reportes. Vive en
// su propio controlador para no entorpecer los @Get(':id')-similares de los
// demás sub-controladores de solicitudes; se registra primero en el módulo
// para que la ruta 'estadisticas' siempre gane ante cualquier ruta paramétrica.
@Controller('solicitudes')
export class SolicitudesEstadisticasController {
  constructor(
    private readonly solicitudesEstadisticasService: SolicitudesEstadisticasService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('estadisticas')
  @Roles(Role.ADMIN)
  obtenerEstadisticas(@Query() filtros: FiltroEstadisticasSolicitudesDto) {
    return this.solicitudesEstadisticasService.obtenerEstadisticas(filtros);
  }
}
