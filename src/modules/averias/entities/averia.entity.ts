import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

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

  // 7. Cédula y nombre de la persona que reporta el daño
  @Column()
  cedula_reportante: string;

  @Column()
  nombre_reportante: string;

  // 8. Fecha y hora automática en la que se registra el reporte en MySQL
  @CreateDateColumn()
  fecha_reporte: Date;

  // NOTA: El campo fontanero_asignado_id lo agregaremos más adelante
  // cuando hagamos las relaciones (FK) entre tablas.
}
