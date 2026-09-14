import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Solicitud } from './solicitud.entity';

@Entity('solicitud_documentos')
export class SolicitudDocumento {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Solicitud, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solicitud_id' })
  solicitud: Solicitud;

  @Column({ type: 'varchar', length: 500 })
  documento_url: string;

  @Column({ type: 'varchar', length: 255 })
  documento_public_id: string;

  @Column({ type: 'varchar', length: 100, default: 'documento_soporte' })
  tipo_documento: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nombre_original: string | null;

  @CreateDateColumn()
  fecha_creacion: Date;
}

