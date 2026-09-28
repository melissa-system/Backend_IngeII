import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportesFontaneroService } from './reportes-fontanero.service';
import { ReportesFontaneroController } from './reportes-fontanero.controller';
import { ReporteFontanero } from './entities/reporte-fontanero.entity';
import { MaterialReporteFontanero } from './entities/material-reporte-fontanero.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { User } from '../auth/entities/user.entity';
import { BitacoraModule } from '../bitacora/bitacora.module';

@Module({
  // Los materiales van en texto libre dentro del propio reporte y ya no se
  // descuentan del inventario (entrada/salida de stock es de administración).
  imports: [
    TypeOrmModule.forFeature([
      ReporteFontanero,
      MaterialReporteFontanero,
      Empleado,
      User,
    ]),
    BitacoraModule,
  ],
  controllers: [ReportesFontaneroController],
  providers: [ReportesFontaneroService],
  exports: [ReportesFontaneroService],
})
export class ReportesFontaneroModule {}
