import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Solicitud } from './solicitud.entity';

// Detalle específico del tipo "cambio de representante". Se une a solicitudes
// por id_solicitud (OneToOne): cada solicitud de cambio de representante tiene
// exactamente una fila acá.
//
// representante_anterior_nombre/cedula se copian del abonado (abonados_juridicos)
// automáticamente al crear la solicitud, para que quede un snapshot histórico
// aunque después el abonado vuelva a cambiar de representante.
@Entity('solicitud_cambio_representante')
export class SolicitudCambioRepresentante {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Solicitud, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_solicitud' })
  solicitud: Solicitud;

  @Column({ type: 'text' })
  representante_anterior_nombre: string;

  @Column({ type: 'text' })
  representante_anterior_cedula: string;

  @Column({ type: 'varchar', length: 255 })
  representante_nuevo_nombre: string;

  @Column({ type: 'varchar', length: 100 })
  representante_nuevo_cedula: string;

  @Column({ type: 'text' })
  representante_nuevo_direccion: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  representante_nuevo_correo: string | null;

  @Column({ type: 'text' })
  justificacion: string;

  // Foto o PDF de la cédula del nuevo representante (Cloudinary).
  @Column({ type: 'varchar', length: 500, nullable: true })
  copia_cedula_url: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  copia_cedula_public_id: string | null;

  // Comentario opcional del administrador cuando rechaza la solicitud.
  @Column({ type: 'text', nullable: true })
  motivo_rechazo: string | null;
}