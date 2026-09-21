import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentosService } from './documentos.service';
import { DocumentosController } from './documentos.controller';
import { Documento } from './entities/documento.entity';
import { User } from '../auth/entities/user.entity';
import { EmpleadosModule } from '../empleados/empleados.module';
import { CloudinaryModule } from '../../config/cloudinary.module';
import { BitacoraModule } from '../bitacora/bitacora.module';

@Module({
  // 1. Aquí le decimos a NestJS que este módulo utiliza la tabla de
  // Documentos, más la de usuarios para resolver el correo de quien hace
  // cada movimiento (lo guarda la bitácora). EmpleadosModule provee
  // EmpleadosService, para saber qué empleado subió cada uno.
  // CloudinaryModule provee el servicio de subida de archivos a la nube.
  // BitacoraModule provee el registro de auditoría.
  imports: [
    TypeOrmModule.forFeature([Documento, User]),
    EmpleadosModule,
    CloudinaryModule,
    BitacoraModule,
  ],
  // 2. Registramos el controlador que va a recibir las peticiones de React
  controllers: [DocumentosController],
  // 3. Registramos el servicio que va a tener las reglas de negocio
  providers: [DocumentosService],
  // 4. Exportamos el servicio por si otros módulos lo necesitan más adelante
  exports: [DocumentosService],
})
export class DocumentosModule {}