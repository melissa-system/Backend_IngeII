import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Common
import { Solicitud } from './common/entities/solicitud.entity';
import { SolicitudDocumento } from './common/entities/solicitud-documento.entity';

// Paja de Agua
import { SolicitudPajaAgua } from './paja-agua/entities/solicitud-paja-agua.entity';
import { SolicitudesController } from './paja-agua/controllers/solicitudes.controller';
import { SolicitudesService } from './paja-agua/services/solicitudes.service';

// Cambio de Medidor
import { SolicitudCambioMedidor } from './cambio-medidor/entities/solicitud-cambio-medidor.entity';
import { SolicitudesCambioMedidorController } from './cambio-medidor/controllers/solicitudes.cambio-medidor.controller';
import { SolicitudesCambioMedidorService } from './cambio-medidor/services/solicitudes.cambio-medidor.service';

// Cambio de Representante
import { SolicitudCambioRepresentante } from './cambio-representante/entities/solicitud-cambio-representante.entity';
import { CambioRepresentanteController } from './cambio-representante/controllers/solicitudes.cambio-representante.controller';
import { CambioRepresentanteService } from './cambio-representante/services/solicitudes.cambio-representante.service';

// Cambio de Propietario
import { SolicitudCambioPropietario } from './cambio-propietario/entities/solicitud-cambio-propietario.entity';
import { SolicitudesCambioPropietarioController } from './cambio-propietario/controllers/solicitudes.cambio-propietario.controller';
import { SolicitudesCambioPropietarioService } from './cambio-propietario/services/solicitudes.cambio-propietario.service';

// Otro
import { SolicitudOtro } from './otro/entities/solicitud-otro.entity';
import { SolicitudesOtroController } from './otro/controllers/solicitudes.otro.controller';
import { SolicitudesOtroService } from './otro/services/solicitudes.otro.service';

// Conexión de servicio (fase 2 de paja de agua)
import { SolicitudConexionPajaAgua } from './conexion-paja-agua/entities/solicitud-conexion-paja-agua.entity';
import { SolicitudesConexionController } from './conexion-paja-agua/controllers/solicitudes-conexion.controller';
import { SolicitudesConexionService } from './conexion-paja-agua/services/solicitudes-conexion.service';

// External modules & entities
import { Abonado } from '../abonados/entities/abonado.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { User } from '../auth/entities/user.entity';
import { HistorialAbonado } from '../abonados/entities/historial-abonado.entity';
import { CloudinaryModule } from '../../config/cloudinary.module';
import { AuthModule } from '../auth/auth.module';
import { BitacoraModule } from '../bitacora/bitacora.module';
import { AbonadosModule } from '../abonados/abonados.module';

@Module({
  // AuthModule se importa para poder inyectar MailService (notificación por
  // correo del resultado de una solicitud). AbonadosModule provee
  // AbonadosService: al aprobar una solicitud de paja de agua, se usa para
  // crear/vincular automáticamente el Abonado (ver SolicitudesService).
  // Sus repos de User/Empleado/Abonado se registran acá también para no
  // depender del re-export de TypeORM.
  imports: [
    TypeOrmModule.forFeature([
      Solicitud,
      SolicitudDocumento,
      SolicitudPajaAgua,
      SolicitudCambioMedidor,
      SolicitudCambioRepresentante,
      SolicitudCambioPropietario,
      SolicitudOtro,
      SolicitudConexionPajaAgua,
      Abonado,
      Empleado,
      User,
      HistorialAbonado,
    ]),
    CloudinaryModule,
    AuthModule,
    BitacoraModule,
    AbonadosModule,
  ],
  controllers: [
    SolicitudesController,
    SolicitudesCambioMedidorController,
    CambioRepresentanteController,
    SolicitudesCambioPropietarioController,
    SolicitudesOtroController,
    SolicitudesConexionController,
  ],
  providers: [
    SolicitudesService,
    SolicitudesCambioMedidorService,
    CambioRepresentanteService,
    SolicitudesCambioPropietarioService,
    SolicitudesOtroService,
    SolicitudesConexionService,
  ],
  exports: [
    SolicitudesService,
    SolicitudesCambioMedidorService,
    CambioRepresentanteService,
    SolicitudesCambioPropietarioService,
    SolicitudesOtroService,
    SolicitudesConexionService,
  ],
})
export class SolicitudesModule {}