import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LaboresAdicionalesService } from './labores-adicionales.service';
import { LaboresAdicionalesController } from './labores-adicionales.controller';
import { LaborAdicional } from './entities/labor-adicional.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { User } from '../auth/entities/user.entity';
import { Solicitud } from '../solicitudes/common/entities/solicitud.entity';
import { BitacoraModule } from '../bitacora/bitacora.module';
import { SolicitudesMaterialModule } from '../solicitudes-material/solicitudes-material.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LaborAdicional, Empleado, User, Solicitud]),
    BitacoraModule,
    // Para no dejar iniciar la labor mientras haya una solicitud de
    // materiales pendiente de aprobación.
    SolicitudesMaterialModule,
  ],
  controllers: [LaboresAdicionalesController],
  providers: [LaboresAdicionalesService],
  exports: [LaboresAdicionalesService],
})
export class LaboresAdicionalesModule {}
