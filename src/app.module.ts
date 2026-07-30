import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AveriasModule } from './modules/averias/averias.module';
import { InventarioModule } from './inventario/inventario.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'AsadaP12345',
      database: 'asada_db',
      autoLoadEntities: true,
      synchronize: true,
    }),
    AveriasModule,
    InventarioModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
