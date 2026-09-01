import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

// Tabla de datos del personal interno de la ASADA (administrativos,
// fontaneros, miembros de junta). El usuario es opcional: se puede
// crear un empleado primero y vincularle una cuenta después.
@Entity('empleados')
export class Empleado {
  @PrimaryGeneratedColumn()
  id: number;

  // Cuenta de acceso vinculada. Opcional: un empleado puede existir
  // sin usuario para después asignarle credenciales.
  @OneToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User | null;

  // Nombre de pila. Los apellidos van por separado (igual que en Abonado):
  // un empleado siempre es persona física, así que no hace falta la
  // distinción física/jurídica que sí tiene abonados.
  @Column()
  nombre: string;

  @Column({ nullable: true })
  apellido1: string | null;

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

  // Correo del empleado. Se guarda siempre (incluso si aún no existe una
  // cuenta de usuario): sirve para vincular después al usuario que se cree
  // con ese mismo correo desde el módulo de Usuarios.
  @Column({ nullable: true })
  correo: string | null;

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
