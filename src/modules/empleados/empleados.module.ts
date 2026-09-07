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
  // EmpleadosService se exporta además de TypeOrmModule: Publicaciones,
  // Documentos y Configuración lo inyectan directamente para resolver
  // id_empleado a partir del usuario autenticado (ver buscarPorUsuarioId).
  exports: [TypeOrmModule, EmpleadosService],
})
export class EmpleadosModule {}
