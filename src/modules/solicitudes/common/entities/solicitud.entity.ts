import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Abonado } from '../../../abonados/entities/abonado.entity';
import { Empleado } from '../../../empleados/entities/empleado.entity';

// Solicitud genérica del sistema: una fila por solicitud, sin importar el
// tipo. Los campos específicos de cada tipo viven en tablas hijo que
// referencian solicitud_id (ej: solicitud_paja_agua, solicitud_cambio_propietario).
//
// Así el frontend puede listar "todas las solicitudes" en el panel y cada
// sub-sección del menú filtra por tipo_solicitud.
@Entity('solicitudes')
export class Solicitud {
  @PrimaryGeneratedColumn()
  id: number;

  // Código único para seguir la solicitud (Ej: SOL-PA-2026-1234)
  @Column({ unique: true })
  codigo_solicitud: string;

  @ManyToOne(() => Abonado, { nullable: false })
  @JoinColumn({ name: 'id_abonado' })
  abonado: Abonado;

  // Tipo de solicitud ('paja_agua', 'cambio_propietario', 'cambio_representante', 'cambio_medidor', 'otro').
  @Column()
  tipo_solicitud: string;

  @Column({
    type: 'enum',
    enum: ['pendiente', 'en_proceso', 'aprobado', 'rechazado'],
    default: 'pendiente',
  })
  estado: string;

  // Empleado que gestionó la solicitud (la creó o le cambió el estado).
  // NULL si el usuario autenticado no tiene un empleado vinculado (p. ej.
  // un abonado creando su propia solicitud).
  @ManyToOne(() => Empleado, { nullable: true })
  @JoinColumn({ name: 'id_empleado' })
  empleado: Empleado | null;

  @CreateDateColumn()
  fecha_creacion: Date;

  @UpdateDateColumn()
  fecha_actualizacion: Date;
}