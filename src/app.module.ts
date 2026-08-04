import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AveriasModule } from './modules/averias/averias.module';
import { InventarioModule } from './inventario/inventario.module';
import { EnvConfig } from './config/env.config';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: EnvConfig().host,
      port: Number(EnvConfig().dbPort),
      username: EnvConfig().username,
      password: EnvConfig().password,
      database: EnvConfig().database,
      autoLoadEntities: true,
      synchronize: true,
      ssl: {
        rejectUnauthorized: false,
      },
    }),
    AveriasModule,
    InventarioModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
