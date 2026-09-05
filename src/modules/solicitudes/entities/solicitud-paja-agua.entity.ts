import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Abonado } from '../../abonados/entities/abonado.entity';

// Tabla dedicada a las solicitudes de paja de agua (nueva conexión).
// Más adelante se podrán agregar otras tablas de solicitudes
// (cambio de domicilio, traslado de medidor, etc.).
//
// IMPORTANTE: esta tabla sigue siendo un snapshot independiente de
// abonados. Los datos del solicitante (nombre, cédula, tipo, teléfono,
// correo, dirección, representante) se guardan acá tal cual llegan del
// formulario público, SIN relación a abonados en ese momento — todavía
// no existe ni el abonado ni el usuario cuando se llena la solicitud.
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

  // URL del archivo en Cloudinary (secure_url). Antes de la migración a la
  // nube estas columnas guardaban el nombre del archivo en uploads/solicitudes;
  // los registros viejos conservan ese valor y siguen sirviéndose desde disco
  // (ver nota de compatibilidad en el README de la Task B3).
  @Column({ type: 'varchar', length: 500, nullable: true })
  permisos_municipales_path: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  carta_solicitud_path: string | null;

  // Identificador del archivo dentro de Cloudinary. Se necesita para poder
  // eliminarlo al reemplazarlo (Task B4). NULL en los registros anteriores
  // a la migración, que viven en disco y no tienen public_id.
  @Column({ type: 'varchar', length: 255, nullable: true })
  permisos_municipales_public_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  carta_solicitud_public_id: string | null;

  @Column({
    type: 'enum',
    enum: ['Pendiente', 'Aprobada', 'Rechazada', 'Completada'],
    default: 'Pendiente',
  })
  estado: string;

  @CreateDateColumn()
  fecha_solicitud: Date;

  // Trazabilidad histórica únicamente: NULL siempre hasta que el
  // administrador aprueba la solicitud y crea el abonado (ver el flujo
  // descrito en Abonado.usuario, punto 2 — todavía no implementado). No se
  // usa ni se exige en el registro público ni en ningún paso previo a esa
  // aprobación; nullable a propósito, no es parte del snapshot original.
  @ManyToOne(() => Abonado, { nullable: true })
  @JoinColumn({ name: 'abonado_id' })
  abonado: Abonado | null;
}