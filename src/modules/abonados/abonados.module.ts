import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbonadosService } from './abonados.service';
import { AbonadosController } from './abonados.controller';
import { Abonado } from './entities/abonado.entity';
import { AbonadoFisico } from './entities/abonado-fisico.entity';
import { AbonadoJuridico } from './entities/abonado-juridico.entity';
import { HistorialAbonado } from './entities/historial-abonado.entity';
import { User } from '../auth/entities/user.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { Solicitud } from '../solicitudes/entities/solicitud.entity';
import { Averia } from '../averias/entities/averia.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Abonado,
      AbonadoFisico,
      AbonadoJuridico,
      HistorialAbonado,
      User,
      Empleado,
      Solicitud,
      Averia,
    ]),
    AuthModule,
  ],
  controllers: [AbonadosController],
  providers: [AbonadosService],
  exports: [AbonadosService],
})
export class AbonadosModule {}
