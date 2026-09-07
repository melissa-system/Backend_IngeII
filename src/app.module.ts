import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AveriasModule } from './modules/averias/averias.module';
import { InventarioModule } from './modules/inventario/inventario.module';
import { AuthModule } from './modules/auth/auth.module';
import { SolicitudesModule } from './modules/solicitudes/solicitudes.module';
import { AbonadosModule } from './modules/abonados/abonados.module';
import { PublicacionesModule } from './modules/publicaciones/publicaciones.module';
import { DocumentosModule } from './modules/documentos/documentos.module';
import { EmpleadosModule } from './modules/empleados/empleados.module';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT')),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: true,
        ssl: {
          rejectUnauthorized: false,
        },
        // Sin esto, mysql2 serializa los Date de JS con la hora LOCAL del
        // proceso de Node (no hay TZ fijado en el entorno) al escribir
        // columnas timestamp, mientras que las consultas comparan con
        // NOW() de MySQL (UTC en Aiven) — el desfase hacía que tokens como
        // el de "restablecer contraseña" (vigencia de 30 min) aparecieran
        // "expirados" casi de inmediato. 'Z' fuerza a mysql2 a leer y
        // escribir siempre en UTC, que es lo que NOW() también usa.
        timezone: 'Z',
      }),
    }),
   
    AuthModule,
    AveriasModule,
    InventarioModule,
    SolicitudesModule,
    AbonadosModule,
    PublicacionesModule,
    DocumentosModule,
    EmpleadosModule,
    ConfiguracionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
