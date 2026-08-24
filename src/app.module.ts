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
      }),
    }),
   
    AuthModule,
    AveriasModule,
    InventarioModule,
    SolicitudesModule,
    AbonadosModule,
    PublicacionesModule,
    DocumentosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
