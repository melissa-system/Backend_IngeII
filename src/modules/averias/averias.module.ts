import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AveriasService } from './averias.service';
import { AveriasController } from './averias.controller';
import { Averia } from './entities/averia.entity';

@Module({
  // 1. Aquí le decimos a NestJS que este módulo utiliza la tabla de Averias
  imports: [TypeOrmModule.forFeature([Averia])],
  
  // 2. Registramos el controlador que va a recibir las peticiones de React
  controllers: [AveriasController],
  
  // 3. Registramos el servicio que va a tener las reglas de negocio
  providers: [AveriasService],
  
  // 4. Exportamos el servicio por si el módulo de abonados o de fontaneros necesita usarlo más adelante
  exports: [AveriasService],
})
export class AveriasModule {}