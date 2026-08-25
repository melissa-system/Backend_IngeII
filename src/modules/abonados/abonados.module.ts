import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbonadosService } from './abonados.service';
import { AbonadosController } from './abonados.controller';
import { Abonado } from './entities/abonado.entity';
import { HistorialAbonado } from './entities/historial-abonado.entity';
import { User } from '../auth/entities/user.entity';

@Module({
  // 1. Aquí le decimos a NestJS que este módulo utiliza la tabla de Abonados
  // (más la de historial y la de usuarios para saber quién editó)
  imports: [TypeOrmModule.forFeature([Abonado, HistorialAbonado, User])],
  // 2. Registramos el controlador que va a recibir las peticiones de React
  controllers: [AbonadosController],
  // 3. Registramos el servicio que va a tener las reglas de negocio
  providers: [AbonadosService],
  // 4. Exportamos el servicio por si otros módulos (averías, fontaneros) necesitan usarlo más adelante
  exports: [AbonadosService],
})
export class AbonadosModule {}
