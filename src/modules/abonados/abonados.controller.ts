import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AbonadosService } from './abonados.service';
import { CreateAbonadoDto } from './dto/create-abonado.dto';
import { UpdateAbonadoDto } from './dto/update-abonado.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('abonados')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AbonadosController {
  constructor(private readonly abonadosService: AbonadosService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() createAbonadoDto: CreateAbonadoDto) {
    return this.abonadosService.create(createAbonadoDto);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.abonadosService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.abonadosService.findOne(id);
  }

  @Get(':id/historial')
  @Roles(Role.ADMIN)
  obtenerHistorial(@Param('id', ParseIntPipe) id: number) {
    return this.abonadosService.obtenerHistorial(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAbonadoDto: UpdateAbonadoDto,
    @Request() req: { user?: RequestUser },
  ) {
    return this.abonadosService.update(id, updateAbonadoDto, req.user?.id);
  }
}