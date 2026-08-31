import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

// 1. Le decimos al ORM que esto se convertirá en la tabla 'abonados' en MySQL
@Entity('abonados')
export class Abonado {
  // 2. Llave primaria auto-incrementable (id INT PK)
  @PrimaryGeneratedColumn()
  id: number;

  // 3. Código único generado automáticamente al registrar al abonado (Ej: AB-2026-0001)
  @Column({ unique: true })
  numero_abonado: string;

  // 4. Tipo de abonado: define qué campos aplican (física vs jurídica)
  @Column({
    type: 'enum',
    enum: ['Física', 'Jurídica'],
  })
  tipo_abonado: string;

  // 5. Nombre completo (persona física) o razón social (persona jurídica)
  @Column()
  nombre_completo: string;

  // 6. Solo aplica a persona jurídica
  @Column({ nullable: true })
  nombre_representante_legal: string;

  // 7. Cédula física o cédula jurídica, según el tipo. Debe ser única.
  @Column({ unique: true })
  cedula: string;

  @Column()
  telefono: string;

  @Column()
  correo: string;

  @Column()
  direccion: string;

  // 8. Solo aplica a persona física, y es opcional dentro de ese caso
  @Column({ nullable: true })
  numero_plano_catastrado: string;

  // 9. Estado del abonado dentro del sistema, activo por defecto al registrarse
  @Column({
    type: 'enum',
    enum: ['Activo', 'Inactivo'],
    default: 'Activo',
  })
  estado: string;

  // 10. Fecha y hora automática en la que se registra el abonado en MySQL
  @CreateDateColumn()
  fecha_registro: Date;

  // 11. Cuenta de acceso vinculada a este abonado. NULL mientras la solicitud
  // de paja de agua está pendiente/en revisión: el flujo real es que la
  // persona llena el formulario público SIN que se le cree usuario todavía;
  // el administrador crea el registro de abonado al aprobar, y es en ESE
  // momento que se crea (o vincula) el usuario con sus credenciales y se le
  // notifican por correo. Un abonado puede existir sin usuario asociado
  // (por eso nullable), pero un usuario no debería quedar asociado a más de
  // un abonado (por eso es OneToOne y no ManyToOne).
  @OneToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User | null;
}
