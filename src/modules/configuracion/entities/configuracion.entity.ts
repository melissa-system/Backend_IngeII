import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Empleado } from '../../empleados/entities/empleado.entity';

/**
 * Configuración general de la ASADA (tabla singleton: siempre 1 fila, id=1).
 * Almacena datos de contacto, horarios y ubicación que se muestran en el
 * landing (sección Ubicación) y en el footer.
 */
@Entity('configuracion')
export class Configuracion {
  @PrimaryGeneratedColumn()
  id: number;

  // ── Datos de contacto / ubicación ────────────────────────────────

  /** Dirección física completa de la ASADA */
  @Column({ type: 'varchar', length: 500, default: '' })
  direccion: string;

  /** Teléfono principal */
  @Column({ type: 'varchar', length: 30, default: '' })
  telefono: string;

  /** Correo electrónico de contacto */
  @Column({ type: 'varchar', length: 150, default: '' })
  correo_electronico: string;

  /** Enlace público de Google Maps (compartir) */
  @Column({ type: 'varchar', length: 500, default: '' })
  enlace_google_maps: string;

  /** Coordenadas para el iframe del mapa (lat,lng) */
  @Column({ type: 'varchar', length: 100, default: '9.9263539,-84.9810364' })
  coordenadas_mapa: string;

  /** Teléfono de miembro de junta #1 */
  @Column({ type: 'varchar', length: 30, default: '' })
  telefono_miembro_junta_1: string;

  /** Teléfono de miembro de junta #2 */
  @Column({ type: 'varchar', length: 30, default: '' })
  telefono_miembro_junta_2: string;

  // ── Horario de atención ──────────────────────────────────────────

  /** Horario de lunes a viernes */
  @Column({ type: 'varchar', length: 100, default: '8:00 am - 5:00 pm' })
  horario_lunes_viernes: string;

  /** Horario de sábados */
  @Column({ type: 'varchar', length: 100, default: '8:00 am - 1:00 pm' })
  horario_sabado: string;

  /** Horario de domingos */
  @Column({ type: 'varchar', length: 100, default: 'Cerrado' })
  horario_domingo: string;

  // ── Autoría ──────────────────────────────────────────────────────

  /** Empleado que hizo el último cambio a esta configuración. Nullable:
   * queda null mientras nadie la actualiza, o si quien la actualizó no
   * tiene un empleado vinculado a su cuenta (ver EmpleadosService). Mismo
   * criterio unificado que publicaciones/documentos/averías/solicitudes. */
  @ManyToOne(() => Empleado, { nullable: true })
  @JoinColumn({ name: 'id_empleado' })
  empleado: Empleado | null;

  // ── Timestamps ───────────────────────────────────────────────────

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
