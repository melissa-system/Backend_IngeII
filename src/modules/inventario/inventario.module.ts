import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventarioService } from './inventario.service';
import { InventarioController } from './inventario.controller';
import { ProveedoresController } from './proveedores.controller';
import { Articulo } from './entities/articulo.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { User } from '../auth/entities/user.entity';
import { BitacoraModule } from '../bitacora/bitacora.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Articulo,
      MovimientoInventario,
      Proveedor,
      User,
    ]),
    BitacoraModule,
  ],
  controllers: [InventarioController, ProveedoresController],
  providers: [InventarioService],
  exports: [InventarioService],
})
export class InventarioModule {}
