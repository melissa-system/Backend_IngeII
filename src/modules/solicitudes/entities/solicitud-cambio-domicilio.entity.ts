import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Solicitud } from './solicitud.entity';

// Detalle específico del tipo "cambio de domicilio". Se une a solicitudes
// por id_solicitud (OneToOne): cada solicitud de cambio de domicilio tiene
// exactamente una fila acá.
//
// direccion_anterior se copia del abonado automáticamente al crear la
// solicitud, para que quede un snapshot histórico aunque después el abonado
// cambie de dirección otra vez.
@Entity('solicitud_cambio_domicilio')
export class SolicitudCambioDomicilio {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Solicitud, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_solicitud' })
  solicitud: Solicitud;

  @Column({ type: 'text' })
  direccion_anterior: string;

  @Column({ type: 'text' })
  direccion_nueva: string;

  @Column({ type: 'text' })
  justificacion: string;

  // Comentario opcional del administrador cuando rechaza la solicitud.
  @Column({ type: 'text', nullable: true })
  motivo_rechazo: string | null;
}