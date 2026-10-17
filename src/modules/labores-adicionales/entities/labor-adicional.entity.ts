import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Empleado } from '../../empleados/entities/empleado.entity';
import { User } from '../../auth/entities/user.entity';
import { TipoActividad } from '../../reportes-fontanero/entities/reporte-fontanero.enums';

// Labor adicional creada por la administración (reparación, instalación,
// mantenimiento u otro) y asignada a un fontanero. Comparte el mismo flujo de
// gestión que una avería: cronómetro, reporte y revisión.
@Entity('labores_adicionales')
@Index(['estado'])
@Index(['fecha_creacion'])
export class LaborAdicional {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  codigo_labor: string;

  @Column({ type: 'enum', enum: TipoActividad })
  tipo_actividad: TipoActividad;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({
    type: 'enum',
    enum: ['Pendiente', 'En proceso', 'En revisión', 'Finalizado'],
    default: 'Pendiente',
  })
  estado: string;

  // Fontanero asignado. Puede quedar sin asignar y asignarse después.
  @ManyToOne(() => Empleado, { nullable: true })
  @JoinColumn({ name: 'id_empleado' })
  empleado: Empleado | null;

  // Cronómetro de la gestión (mismas reglas que en averías).
  @Column({ type: 'datetime', nullable: true })
  gestion_iniciada_en: Date | null;

  @Column({ type: 'datetime', nullable: true })
  gestion_finalizada_en: Date | null;

  // Si la administración rechazó la resolución del reporte, la labor vuelve al
  // fontanero marcada como "devuelta" con el motivo.
  @Column({ type: 'boolean', default: false })
  devuelta_revision: boolean;

  @Column({ type: 'text', nullable: true })
  motivo_revision: string | null;

  // Quién creó la labor (admin/junta).
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'creado_por_id' })
  creado_por: User | null;

  @CreateDateColumn()
  fecha_creacion: Date;
}
