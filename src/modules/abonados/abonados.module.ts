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
import { AuthModule } from '../auth/auth.module';

@Module({
  // 1. Aquí le decimos a NestJS que este módulo utiliza la tabla de Abonados
  // (más las subtablas de física/jurídica, la de historial, la de usuarios
  // para saber quién editó, y la de empleados solo para poder validar que
  // una cédula no esté repetida entre Abonados y Empleados).
  // AuthModule provee AuthService, para desactivar la cuenta de usuario
  // vinculada cuando se inhabilita un abonado (ver cambiarEstado).
  imports: [
    TypeOrmModule.forFeature([
      Abonado,
      AbonadoFisico,
      AbonadoJuridico,
      HistorialAbonado,
      User,
      Empleado,
    ]),
    AuthModule,
  ],
  // 2. Registramos el controlador que va a recibir las peticiones de React
  controllers: [AbonadosController],
  // 3. Registramos el servicio que va a tener las reglas de negocio
  providers: [AbonadosService],
  // 4. Exportamos el servicio por si otros módulos (averías, fontaneros) necesitan usarlo más adelante
  exports: [AbonadosService],
})
export class AbonadosModule {}
