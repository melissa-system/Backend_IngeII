import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentosService } from './documentos.service';
import { DocumentosController } from './documentos.controller';
import { Documento } from './entities/documento.entity';
import { User } from '../auth/entities/user.entity';
import { CloudinaryModule } from '../../config/cloudinary.module';

@Module({
  // 1. Aquí le decimos a NestJS que este módulo utiliza la tabla de
  // Documentos (más la de usuarios, para saber quién subió cada uno)
  // 2. CloudinaryModule provee el servicio de subida de archivos a la nube
  imports: [TypeOrmModule.forFeature([Documento, User]), CloudinaryModule],
  // 3. Registramos el controlador que va a recibir las peticiones de React
  controllers: [DocumentosController],
  // 4. Registramos el servicio que va a tener las reglas de negocio
  providers: [DocumentosService],
  // 5. Exportamos el servicio por si otros módulos lo necesitan más adelante
  exports: [DocumentosService],
})
export class DocumentosModule {}