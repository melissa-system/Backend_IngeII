import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Empleado } from './entities/empleado.entity';
import { User } from '../auth/entities/user.entity';
import { EmpleadosService } from './empleados.service';
import { EmpleadosController } from './empleados.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Empleado, User])],
  controllers: [EmpleadosController],
  providers: [EmpleadosService],
  exports: [TypeOrmModule],
})
export class EmpleadosModule {}
