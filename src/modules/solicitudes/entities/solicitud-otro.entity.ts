import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Solicitud } from './solicitud.entity';

// Detalle específico del tipo "otro": trámite abierto que no encaja en los
// tipos predefinidos (cambio de domicilio, representante, medidor...). Se une
// a solicitudes por id_solicitud (OneToOne), igual que los demás detalles.
//
// A diferencia de los otros tipos, aprobar esta solicitud NO actualiza nada
// del abonado: la resolución queda documentada como comentario del
// administrador (motivo_rechazo) y se notifica por correo.
@Entity('solicitud_otro')
export class SolicitudOtro {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Solicitud, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_solicitud' })
  solicitud: Solicitud;

  // Asunto corto del trámite: funciona como resumen en las tablas del panel
  // en vez de un "tipo" fijo (ej: "Constancia de no adeudar", "Ajuste de
  // aforo", "Revisión de la tubería hacia mi vivienda"...).
  @Column({ type: 'varchar', length: 150 })
  asunto: string;

  @Column({ type: 'text' })
  justificacion: string;

  // Archivo de soporte opcional (factura, plano, informe...), en Cloudinary.
  @Column({ type: 'varchar', length: 500, nullable: true })
  adjunto_url: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  adjunto_public_id: string | null;

  // Comentario del administrador al aprobar o rechazar. En este tipo es
  // obligatorio al cerrar la solicitud, porque no hay un efecto estructurado
  // que documente qué se resolvió.
  @Column({ type: 'text', nullable: true })
  motivo_rechazo: string | null;
}