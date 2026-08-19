import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudPajaAgua } from './entities/solicitud-paja-agua.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SolicitudPajaAgua])],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
