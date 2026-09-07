import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicacionesService } from './publicaciones.service';
import { PublicacionesController } from './publicaciones.controller';
import { Publicacion } from './entities/publicacion.entity';
import { EmpleadosModule } from '../empleados/empleados.module';

@Module({
  // 1. Aquí le decimos a NestJS que este módulo utiliza la tabla de
  // Publicaciones. EmpleadosModule provee EmpleadosService, para resolver
  // qué empleado creó cada publicación a partir del usuario autenticado.
  imports: [TypeOrmModule.forFeature([Publicacion]), EmpleadosModule],
  // 2. Registramos el controlador que va a recibir las peticiones de React
  controllers: [PublicacionesController],
  // 3. Registramos el servicio que va a tener las reglas de negocio
  providers: [PublicacionesService],
  // 4. Exportamos el servicio por si otros módulos lo necesitan más adelante
  exports: [PublicacionesService],
})
export class PublicacionesModule {}
