import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { LaboresAdicionalesService } from './labores-adicionales.service';
import { CrearLaborDto } from './dto/crear-labor.dto';
import { ActualizarLaborDto } from './dto/actualizar-labor.dto';
import { FiltrarLaboresDto } from './dto/filtrar-labores.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('labores')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LaboresAdicionalesController {
  constructor(private readonly service: LaboresAdicionalesService) {}

  // La administración crea la labor y, opcionalmente, la asigna a un fontanero.
  @Post()
  @Roles(Role.ADMIN)
  crear(@Body() dto: CrearLaborDto, @Request() req: { user?: RequestUser }) {
    return this.service.crear(dto, req.user?.id);
  }

  // Bandeja del fontanero. Va antes de ':id' para no interpretarse como id.
  @Get('mis-labores')
  @Roles(Role.FONTANERO)
  misLabores(@Request() req: { user?: RequestUser }) {
    return this.service.misLabores(req.user!);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll(@Query() filtros: FiltrarLaboresDto) {
    return this.service.findAll(filtros);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarLaborDto,
    @Request() req: { user?: RequestUser },
  ) {
    return this.service.actualizar(id, dto, req.user?.id);
  }

  @Patch(':id/iniciar-gestion')
  @Roles(Role.FONTANERO)
  iniciarGestion(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: RequestUser },
  ) {
    return this.service.iniciarGestion(id, req.user!);
  }

  @Patch(':id/terminar-gestion')
  @Roles(Role.FONTANERO)
  terminarGestion(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: RequestUser },
  ) {
    return this.service.terminarGestion(id, req.user!);
  }
}
