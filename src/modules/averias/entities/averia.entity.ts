import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Empleado } from '../../empleados/entities/empleado.entity';

// 1. Le decimos al ORM que esto se convertirá en la tabla 'averias' en MySQL
@Entity('averias')
export class Averia {
  // 2. Llave primaria auto-incrementable (id INT PK)
  @PrimaryGeneratedColumn()
  id: number;

  // 3. Código único para identificar la avería (Ej: AVE-2026-001)
  @Column({ unique: true })
  codigo_averia: string;

  // 4. Un ENUM para que solo permita los tipos de avería válidos de la ASADA
  @Column({
    type: 'enum',
    enum: ['Fuga', 'Tubería rota', 'Medidor dañado', 'Otro'],
  })
  tipo_averia: string;

  // 5. Descripción detallada del problema (TEXT)
  @Column({ type: 'text' })
  descripcion: string;

  // 6. Estado del reporte con un valor por defecto al crearse
  @Column({
    type: 'enum',
    enum: ['Pendiente', 'En proceso', 'Finalizado'],
    default: 'Pendiente',
  })
  estado: string;

  // 7. Cédula y nombre de la persona que reporta el daño. El nombre se
  // guarda dividido (nombre de pila + apellidos por separado) en vez de
  // un solo string. apellido2 es nullable porque no toda persona tiene
  // segundo apellido registrado.
  @Column()
  cedula_reportante: string;

  @Column()
  nombre_reportante: string;

  @Column({ nullable: true })
  apellido1_reportante: string;

  @Column({ nullable: true })
  apellido2_reportante: string;

  // 8. Fecha y hora automática en la que se registra el reporte en MySQL
  @CreateDateColumn()
  fecha_reporte: Date;

  // 9. Fontanero responsable del caso. NULL al crear el reporte: se
  // completa después, cuando el personal administrativo asigna el caso al
  // actualizar el estado (esa ruta de asignación todavía no existe —
  // AveriasController solo tiene create/findAll — queda como tarea
  // aparte). Apunta a empleados (no a usuarios) porque acá sí interesa
  // identificar al funcionario específico, con sus datos de personal.
  @ManyToOne(() => Empleado, { nullable: true })
  @JoinColumn({ name: 'fontanero_asignado_id' })
  fontanero_asignado: Empleado | null;
}
