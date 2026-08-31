import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

// Tabla espejo de Abonado, pero para el personal interno de la ASADA
// (administrativos, fontaneros, miembros de junta). Todo empleado tiene
// cuenta de acceso (a diferencia de un abonado, cuyo usuario es opcional
// hasta que se le crea una cuenta): por eso usuario es obligatorio acá.
@Entity('empleados')
export class Empleado {
  @PrimaryGeneratedColumn()
  id: number;

  // Cuenta de acceso del empleado. Obligatoria: todo empleado necesita
  // poder iniciar sesión en el sistema.
  @OneToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  // Nombre de pila. Los apellidos van por separado (igual que en Abonado):
  // un empleado siempre es persona física, así que no hace falta la
  // distinción física/jurídica que sí tiene abonados.
  @Column()
  nombre: string;

  @Column()
  apellido1: string;

  @Column({ nullable: true })
  apellido2: string | null;

  @Column({ unique: true })
  cedula: string;

  // Puesto/cargo dentro de la ASADA (Ej: 'Fontanero de campo', 'Encargada
  // de facturación'). Texto libre: el rol de acceso (admin/fontanero/...)
  // ya lo maneja usuarios.role_id; esto es solo el título del puesto.
  @Column()
  puesto: string;

  @Column()
  telefono: string;

  @Column({ type: 'date' })
  fecha_ingreso: string;

  @Column({
    type: 'enum',
    enum: ['Activo', 'Inactivo'],
    default: 'Activo',
  })
  estado: string;

  @CreateDateColumn()
  fecha_registro: Date;
}
