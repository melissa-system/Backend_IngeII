import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AveriasService } from './averias.service';
import { AveriasController } from './averias.controller';
import { Averia } from './entities/averia.entity';
import { HistorialAveria } from './entities/historial-averia.entity';
import { Empleado } from '../empleados/entities/empleado.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Averia, HistorialAveria, Empleado]),
  ],
  controllers: [AveriasController],
  providers: [AveriasService],
  exports: [AveriasService],
})
export class AveriasModule {}
