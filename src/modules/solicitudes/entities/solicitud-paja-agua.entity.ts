import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

// Tabla dedicada a las solicitudes de paja de agua (nueva conexión).
// Más adelante se podrán agregar otras tablas de solicitudes
// (cambio de domicilio, traslado de medidor, etc.).
@Entity('solicitud_paja_agua')
export class SolicitudPajaAgua {
  @PrimaryGeneratedColumn()
  id: number;

  // Código único para identificar la solicitud (Ej: SOL-2026-001)
  @Column({ unique: true })
  codigo_solicitud: string;

  // Tipo de solicitante: persona física o jurídica
  @Column({ type: 'enum', enum: ['fisica', 'juridica'] })
  tipo_persona: string;

  @Column()
  nombre_solicitante: string;

  // Cédula nacional, DIMEX o cédula jurídica según el tipo de persona
  @Column()
  identificacion: string;

  // Solo aplica cuando tipo_persona es 'juridica'
  @Column({ type: 'varchar', nullable: true })
  nombre_representante: string | null;

  @Column({ type: 'varchar', nullable: true })
  cedula_representante: string | null;

  @Column()
  telefono: string;

  @Column()
  correo: string;

  @Column({ type: 'text' })
  direccion: string;

  @Column()
  numero_plano: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  // Ruta del archivo adjunto guardado en el servidor (uploads/solicitudes)
  @Column({ type: 'varchar', nullable: true })
  permisos_municipales_path: string | null;

  @Column({ type: 'varchar', nullable: true })
  carta_solicitud_path: string | null;

  @Column({
    type: 'enum',
    enum: ['Pendiente', 'Aprobada', 'Rechazada', 'Completada'],
    default: 'Pendiente',
  })
  estado: string;

  @CreateDateColumn()
  fecha_solicitud: Date;
}
