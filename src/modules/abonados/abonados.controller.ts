import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AbonadosService } from './abonados.service';
import { CreateAbonadoDto } from './dto/create-abonado.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';

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
}