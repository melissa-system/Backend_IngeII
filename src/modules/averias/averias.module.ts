import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AveriasService } from './averias.service';
import { AveriasController } from './averias.controller';
import { Averia } from './entities/averia.entity';
import { HistorialAveria } from './entities/historial-averia.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { Abonado } from '../abonados/entities/abonado.entity';
import { BitacoraModule } from '../bitacora/bitacora.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Averia, HistorialAveria, Empleado, Abonado]),
    BitacoraModule,
  ],
  controllers: [AveriasController],
  providers: [AveriasService],
  exports: [AveriasService],
})
export class AveriasModule {}
