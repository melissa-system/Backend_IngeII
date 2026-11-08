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
import { Solicitud } from '../../solicitudes/common/entities/solicitud.entity';
import { TipoActividad } from '../../reportes-fontanero/entities/reporte-fontanero.enums';

// Resumen de los datos operativos de la solicitud que originó la labor. Se
// guarda como copia (no se consulta en vivo) para que el fontanero vea a
// dónde ir desde su propia bandeja, sin depender del módulo de solicitudes.
export interface DatosSolicitudLabor {
  codigo_solicitud: string;
  tipo_solicitud: string;
  abonado: {
    nombre: string;
    numero_abonado: string;
    cedula: string;
    telefono: string;
  };
  direccion: string;
  numero_nis: string | null;
}

// Labor adicional creada por la administración (reparación, instalación,
// mantenimiento u otro) y asignada a un fontanero. Comparte el mismo flujo de
// gestión que una avería: cronómetro, reporte y revisión.
//
// También puede generarse automáticamente al aprobar una solicitud de
// conexión de servicio o de cambio de medidor (origen = 'solicitud'): en ese
// caso queda pendiente y sin fontanero, esperando que la administración la
// asigne.
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

  // De dónde salió la labor: creada a mano por la administración o generada
  // al aprobar una solicitud. Las labores anteriores quedan como 'manual'.
  @Column({
    type: 'enum',
    enum: ['manual', 'solicitud'],
    default: 'manual',
  })
  origen: 'manual' | 'solicitud';

  // Solicitud aprobada que originó la labor (solo si origen = 'solicitud').
  @ManyToOne(() => Solicitud, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_solicitud' })
  solicitud: Solicitud | null;

  @Column({ type: 'int', nullable: true })
  id_solicitud: number | null;

  // Copia de abonado, dirección y NIS de la solicitud, para mostrarla en la
  // bandeja del fontanero y en el detalle de la labor.
  @Column({ type: 'json', nullable: true })
  datos_solicitud: DatosSolicitudLabor | null;

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
