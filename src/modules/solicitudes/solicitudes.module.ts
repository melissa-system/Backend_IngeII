import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudPajaAgua } from './entities/solicitud-paja-agua.entity';
import { Solicitud } from './entities/solicitud.entity';
import { SolicitudCambioDomicilio } from './entities/solicitud-cambio-domicilio.entity';
import { CambioDomicilioService } from './solicitudes.cambio-domicilio.service';
import { CambioDomicilioController } from './solicitudes.cambio-domicilio.controller';
import { Abonado } from '../abonados/entities/abonado.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { User } from '../auth/entities/user.entity';
import { HistorialAbonado } from '../abonados/entities/historial-abonado.entity';
import { CloudinaryModule } from '../../config/cloudinary.module';
import { AuthModule } from '../auth/auth.module';
import { SolicitudCambioMedidor } from './entities/solicitud-cambio-medidor.entity';
import { SolicitudesCambioMedidorController } from './solicitudes.cambio-medidor.controller';
import { SolicitudesCambioMedidorService } from './solicitudes.cambio-medidor.service';
import { SolicitudCambioRepresentante } from './entities/solicitud-cambio-representante.entity';
import { CambioRepresentanteController } from './solicitudes.cambio-representante.controller';
import { CambioRepresentanteService } from './solicitudes.cambio-representante.service';

@Module({
  // AuthModule se importa para poder inyectar MailService (notificación por
  // correo del resultado de una solicitud). Sus repos de User/Empleado/Abonado
  // se registran acá también para no depender del re-export de TypeORM.
  imports: [
    TypeOrmModule.forFeature([
      SolicitudPajaAgua,
      Solicitud,
      SolicitudCambioDomicilio,
      SolicitudCambioMedidor,
      SolicitudCambioRepresentante,
      Abonado,
      Empleado,
      User,
      HistorialAbonado,
    ]),
    CloudinaryModule,
    AuthModule,
  ],
  controllers: [
    SolicitudesController,
    CambioDomicilioController,
    SolicitudesCambioMedidorController,
    CambioRepresentanteController,
  ],
  providers: [
    SolicitudesService,
    CambioDomicilioService,
    SolicitudesCambioMedidorService,
    CambioRepresentanteService,
  ],
  exports: [
    SolicitudesService,
    CambioDomicilioService,
    SolicitudesCambioMedidorService,
    CambioRepresentanteService,
  ],
})
export class SolicitudesModule {}