import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Empleado } from './entities/empleado.entity';
import { User } from '../auth/entities/user.entity';
import { Abonado } from '../abonados/entities/abonado.entity';
import { EmpleadosService } from './empleados.service';
import { EmpleadosController } from './empleados.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  // Abonado se registra solo para poder validar que una cédula no esté ya
  // usada por un abonado (ver EmpleadosService.crear/actualizar) — no crea
  // dependencia de AbonadosModule, solo repositorio. AuthModule provee
  // AuthService, necesario para crear la cuenta de acceso de un empleado
  // cuando se vincula por correo (ver vincularCuenta).
  imports: [TypeOrmModule.forFeature([Empleado, User, Abonado]), AuthModule],
  controllers: [EmpleadosController],
  providers: [EmpleadosService],
  // EmpleadosService se exporta además de TypeOrmModule: Publicaciones,
  // Documentos y Configuración lo inyectan directamente para resolver
  // id_empleado a partir del usuario autenticado (ver buscarPorUsuarioId).
  exports: [TypeOrmModule, EmpleadosService],
})
export class EmpleadosModule {}
