import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Empleado } from './entities/empleado.entity';

// Módulo mínimo: por ahora solo registra la tabla (ver punto 6 de la
// conversación con Meli — "empleados existe como tabla de datos
// adicionales del personal", sin CRUD/UI todavía). Se exporta
// TypeOrmModule para que otros módulos (por ejemplo averías, para el FK
// fontanero_asignado_id) puedan inyectar su repositorio si lo necesitan.
@Module({
  imports: [TypeOrmModule.forFeature([Empleado])],
  exports: [TypeOrmModule],
})
export class EmpleadosModule {}
