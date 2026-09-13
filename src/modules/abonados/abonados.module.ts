import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { POLITICA_REENVIO_ACCESO_THROTTLE } from './abonados-throttle.config';

@Module({
  // 1. Aquí le decimos a NestJS que este módulo utiliza la tabla de Abonados
  // (más las subtablas de física/jurídica, la de historial, la de usuarios
  // para saber quién editó, y la de empleados solo para poder validar que
  // una cédula no esté repetida entre Abonados y Empleados).
  // AuthModule provee AuthService, para desactivar la cuenta de usuario
  // vinculada cuando se inhabilita un abonado (ver cambiarEstado).
  // ThrottlerModule propio (no el de AuthModule, que no se exporta) para
  // limitar el reenvío de correo de acceso — ver abonados-throttle.config.ts.
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
    ThrottlerModule.forRoot([POLITICA_REENVIO_ACCESO_THROTTLE.default]),
  ],
  controllers: [AbonadosController],
  providers: [AbonadosService],
  exports: [AbonadosService],
})
export class AbonadosModule {}
