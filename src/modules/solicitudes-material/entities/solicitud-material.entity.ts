import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Empleado } from '../../empleados/entities/empleado.entity';
import { User } from '../../auth/entities/user.entity';
import { Averia } from '../../averias/entities/averia.entity';
import { LaborAdicional } from '../../labores-adicionales/entities/labor-adicional.entity';
import { DetalleSolicitudMaterial } from './detalle-solicitud-material.entity';

// Pedido de materiales que hace el fontanero ANTES de atender un trabajo.
//
// Nace "Pendiente" y la administración (o la Junta Directiva) lo aprueba o lo
// rechaza desde Inventario. Al aprobarlo se descuenta el stock y se registran
// los movimientos de salida; hasta entonces el fontanero no puede iniciar la
// gestión del trabajo.
//
// Se liga a UNA avería o a UNA labor (nunca a ambas): con eso cubre tanto las
// averías reportadas por abonados como las labores de "Otros mantenimientos".
@Entity('solicitudes_material')
@Index(['estado'])
@Index(['fecha_creacion'])
export class SolicitudMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  codigo_solicitud_material: string;

  // Fontanero que la solicita.
  @ManyToOne(() => Empleado, { nullable: false })
  @JoinColumn({ name: 'id_empleado' })
  empleado: Empleado;

  // Trabajo para el que se piden los materiales. Excluyentes.
  @ManyToOne(() => Averia, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_averia' })
  averia: Averia | null;

  @Column({ type: 'int', nullable: true })
  id_averia: number | null;

  @ManyToOne(() => LaborAdicional, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_labor' })
  labor: LaborAdicional | null;

  @Column({ type: 'int', nullable: true })
  id_labor: number | null;

  @Column({
    type: 'enum',
    enum: ['Pendiente', 'Aprobada', 'Rechazada', 'Cancelada'],
    default: 'Pendiente',
  })
  estado: string;

  // Por qué necesita esos materiales (lo escribe el fontanero).
  @Column({ type: 'text' })
  motivo: string;

  @Column({ type: 'text', nullable: true })
  motivo_rechazo: string | null;

  // Administración que aprobó o rechazó la solicitud.
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_revisado_por' })
  revisado_por: User | null;

  @Column({ type: 'datetime', nullable: true })
  fecha_revision: Date | null;

  @OneToMany(() => DetalleSolicitudMaterial, (detalle) => detalle.solicitud)
  detalles: DetalleSolicitudMaterial[];

  @CreateDateColumn()
  fecha_creacion: Date;

  @UpdateDateColumn()
  fecha_actualizacion: Date;
}
