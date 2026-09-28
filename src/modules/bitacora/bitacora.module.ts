import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bitacora } from './entities/bitacora.entity';
import { BitacoraService } from './bitacora.service';
import { BitacoraController } from './bitacora.controller';

// Módulo transversal: cualquier otro módulo que necesite dejar constancia de
// sus operaciones importa BitacoraModule e inyecta BitacoraService.
//
// Mismo criterio que CloudinaryModule: no se marca @Global a propósito, para
// que quede explícito en cada módulo que audita sus acciones.
@Module({
  imports: [TypeOrmModule.forFeature([Bitacora])],
  controllers: [BitacoraController],
  providers: [BitacoraService],
  exports: [BitacoraService],
})
export class BitacoraModule {}