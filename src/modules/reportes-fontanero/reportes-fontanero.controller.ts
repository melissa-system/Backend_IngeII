import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ReportesFontaneroService } from './reportes-fontanero.service';
import { CrearReporteFontaneroDto } from './dto/crear-reporte-fontanero.dto';
import { FiltrarReportesFontaneroDto } from './dto/filtrar-reportes-fontanero.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('reportes-fontanero')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportesFontaneroController {
  constructor(private readonly service: ReportesFontaneroService) {}

  // POST /reportes-fontanero
  // Solo el fontanero registra su actividad. El SUPER_ADMIN (Junta Directiva)
  // también pasa, porque el RolesGuard le da acceso total al sistema.
  @Post()
  @Roles(Role.FONTANERO)
  crear(
    @Body() dto: CrearReporteFontaneroDto,
    @Request() req: { user?: RequestUser },
  ) {
    return this.service.crear(dto, req.user!);
  }

  // GET /reportes-fontanero/mis-reportes
  // Los reportes del fontanero autenticado, para su propia pantalla.
  // Va ANTES de la ruta ':id' para que 'mis-reportes' no se interprete como
  // un id.
  @Get('mis-reportes')
  @Roles(Role.FONTANERO)
  misReportes(@Request() req: { user?: RequestUser }) {
    return this.service.misReportes(req.user!);
  }

  // GET /reportes-fontanero?empleadoId=&tipoActividad=&desde=&hasta=&pagina=
  // Consulta administrativa con filtros y paginación.
  @Get()
  @Roles(Role.ADMIN)
  buscar(@Query() filtros: FiltrarReportesFontaneroDto) {
    return this.service.buscar(filtros);
  }

  // GET /reportes-fontanero/:id — detalle con el desglose de materiales.
  @Get(':id')
  @Roles(Role.ADMIN)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.service.obtenerPorId(id);
  }
}
