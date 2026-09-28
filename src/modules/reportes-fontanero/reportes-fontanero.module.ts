import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportesFontaneroService } from './reportes-fontanero.service';
import { ReportesFontaneroController } from './reportes-fontanero.controller';
import { ReporteFontanero } from './entities/reporte-fontanero.entity';
import { MaterialReporteFontanero } from './entities/material-reporte-fontanero.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { User } from '../auth/entities/user.entity';
import { InventarioModule } from '../inventario/inventario.module';
import { BitacoraModule } from '../bitacora/bitacora.module';

@Module({
  // InventarioModule provee InventarioService, que es quien descuenta el
  // stock de los materiales usados (ver descontarMaterialEnTransaccion).
  imports: [
    TypeOrmModule.forFeature([
      ReporteFontanero,
      MaterialReporteFontanero,
      Empleado,
      User,
    ]),
    InventarioModule,
    BitacoraModule,
  ],
  controllers: [ReportesFontaneroController],
  providers: [ReportesFontaneroService],
  exports: [ReportesFontaneroService],
})
export class ReportesFontaneroModule {}
