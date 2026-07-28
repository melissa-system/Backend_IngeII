import { Module } from '@nestjs/common';
<<<<<<< HEAD
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
=======
import { TypeOrmModule } from '@nestjs/typeorm';
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
})
export class AppModule {}
>>>>>>> 159a38f (feat: modulo backend de reporte de averias terminado)
