import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Solicitud } from '../../common/entities/solicitud.entity';

// Detalle específico del tipo "cambio de propietario" (cesión de derechos de paja de agua).
// Se une a solicitudes por solicitud_id (OneToOne): cada solicitud de cambio de propietario
// tiene exactamente una fila acá.
@Entity('solicitud_cambio_propietario')
export class SolicitudCambioPropietario {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Solicitud, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solicitud_id' })
  solicitud: Solicitud;

  @Column({ type: 'varchar', length: 255 })
  nombre_nuevo_propietario: string;

  @Column({ type: 'varchar', length: 50 })
  cedula_nuevo_propietario: string;

  @Column({ type: 'varchar', length: 50 })
  telefono_nuevo_propietario: string;

  @Column({ type: 'varchar', length: 255 })
  correo_nuevo_propietario: string;

  @Column({ type: 'varchar', length: 100 })
  motivo_traspaso: string;

  @Column({ type: 'text' })
  justificacion: string;

  // Snapshot directo del archivo de soporte (también registrado en solicitud_documentos)
  @Column({ type: 'varchar', length: 500, nullable: true })
  documento_soporte_url: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  documento_soporte_public_id: string | null;

  // Comentario opcional del administrador cuando rechaza la solicitud.
  @Column({ type: 'text', nullable: true })
  motivo_rechazo: string | null;
}

