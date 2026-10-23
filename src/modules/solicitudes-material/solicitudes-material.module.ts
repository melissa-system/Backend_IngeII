import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolicitudMaterial } from './entities/solicitud-material.entity';
import { DetalleSolicitudMaterial } from './entities/detalle-solicitud-material.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { Averia } from '../averias/entities/averia.entity';
import { LaborAdicional } from '../labores-adicionales/entities/labor-adicional.entity';
import { Articulo } from '../inventario/entities/articulo.entity';
import { User } from '../auth/entities/user.entity';
import { InventarioModule } from '../inventario/inventario.module';
import { BitacoraModule } from '../bitacora/bitacora.module';
import { SolicitudesMaterialService } from './solicitudes-material.service';
import { SolicitudesMaterialController } from './solicitudes-material.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SolicitudMaterial,
      DetalleSolicitudMaterial,
      Empleado,
      Averia,
      LaborAdicional,
      Articulo,
      User,
    ]),
    // El descuento de stock vive en InventarioService (un solo lugar donde se
    // tocan las existencias). BitacoraModule audita el ciclo de la solicitud.
    InventarioModule,
    BitacoraModule,
  ],
  controllers: [SolicitudesMaterialController],
  providers: [SolicitudesMaterialService],
  exports: [SolicitudesMaterialService],
})
export class SolicitudesMaterialModule {}
