import {
  Controller,
  Get,
  Query,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { BitacoraService } from './bitacora.service';
import { FiltrarBitacoraDto } from './dto/filtrar-bitacora.dto';
import { ModuloBitacora } from './entities/bitacora.enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';

// Bitácora: SOLO LECTURA. No hay POST, PATCH ni DELETE a propósito — los
// registros se escriben únicamente desde BitacoraService, invocado por los
// propios módulos cuando ejecutan una operación. Una bitácora que se puede
// modificar desde fuera no sirve como auditoría.
//
// Todo el controlador está restringido a la Junta Directiva (SUPER_ADMIN):
// la bitácora expone quién hizo qué en todo el sistema y el Administrador no
// tiene acceso, igual que en el menú del frontend.
@Controller('bitacora')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class BitacoraController {
  constructor(private readonly bitacoraService: BitacoraService) {}

  // GET /bitacora?modulo=abonados&usuario_id=3&desde=2026-09-01&hasta=2026-09-05&pagina=1
  // Consulta general con filtros y paginación.
  @Get()
  buscar(@Query() filtros: FiltrarBitacoraDto) {
    return this.bitacoraService.buscar(filtros);
  }

  // GET /bitacora/abonados/12
  // Historial completo de un registro concreto. Atajo del filtro anterior,
  // pensado para la pestaña "historial" del detalle de cada registro.
  @Get(':modulo/:registroId')
  historialDeRegistro(
    @Param('modulo') modulo: ModuloBitacora,
    @Param('registroId', ParseIntPipe) registroId: number,
  ) {
    return this.bitacoraService.historialDeRegistro(modulo, registroId);
  }
}