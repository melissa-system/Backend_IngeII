import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AveriasService } from './averias.service';
import { CreateAveriaDto } from './dto/create-averia.dto';
import { UpdateAveriaDto } from './dto/update-averia.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';

@Controller('averias')
export class AveriasController {
  constructor(private readonly averiasService: AveriasService) {}

  @Post()
  create(@Body() createAveriaDto: CreateAveriaDto) {
    return this.averiasService.create(createAveriaDto);
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
  ) {
    return this.averiasService.actualizar(id, dto);
  }
}
