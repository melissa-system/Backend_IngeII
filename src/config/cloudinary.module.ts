import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryProvider, CLOUDINARY } from './cloudinary.provider';

// Módulo compartido: cualquier otro módulo que necesite subir archivos a la
// nube (documentos, solicitudes, averías...) importa CloudinaryModule y pide
// el token CLOUDINARY. No se marca @Global a propósito, para que quede
// explícito en cada módulo qué depende del almacenamiento externo.
@Module({
  imports: [ConfigModule],
  providers: [CloudinaryProvider],
  exports: [CloudinaryProvider],
})
export class CloudinaryModule {}

export { CLOUDINARY };