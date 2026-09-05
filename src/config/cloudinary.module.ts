import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryProvider, CLOUDINARY } from './cloudinary.provider';
import { CloudinaryService } from './cloudinary.service';

// Módulo compartido: cualquier otro módulo que necesite subir archivos a la
// nube (documentos, solicitudes, foto de perfil...) importa CloudinaryModule
// e inyecta CloudinaryService. No se marca @Global a propósito, para que
// quede explícito en cada módulo qué depende del almacenamiento externo.
@Module({
  imports: [ConfigModule],
  providers: [CloudinaryProvider, CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}

export { CLOUDINARY };