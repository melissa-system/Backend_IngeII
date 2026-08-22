import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

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
}
