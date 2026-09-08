import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Solicitud } from './solicitud.entity';

@Entity('solicitud_cambio_medidor')
export class SolicitudCambioMedidor {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Solicitud, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_solicitud' })
  solicitud: Solicitud;

  @Column({ type: 'varchar', length: 100 })
  motivo_falla: string;

  @Column({ type: 'varchar', length: 255 })
  direccion_exacta: string;

  @Column({ type: 'text' })
  justificacion: string;

  // Almacenamiento en la nube con Cloudinary
  @Column({ type: 'varchar', length: 500, nullable: true })
  evidencia_url: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  evidencia_public_id: string | null;

  @Column({ type: 'text', nullable: true })
  motivo_rechazo: string | null;
}