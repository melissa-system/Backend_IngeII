import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Empleado } from '../../empleados/entities/empleado.entity';
import { Averia } from '../../averias/entities/averia.entity';
import { LaborAdicional } from '../../labores-adicionales/entities/labor-adicional.entity';
import {
  EstadoRevisionReporte,
  TipoActividad,
} from './reporte-fontanero.enums';
import { MaterialReporteFontanero } from './material-reporte-fontanero.entity';

// Reporte de actividad que llena el fontanero después de atender un trabajo.
@Entity('reportes_fontanero')
// Índices por los filtros del panel administrativo: por fontanero y por fecha.
@Index(['empleado_id'])
@Index(['fecha_trabajo'])
export class ReporteFontanero {
  @PrimaryGeneratedColumn()
  id: number;

  // Fontanero que hizo el trabajo. Se resuelve del usuario autenticado y no
  // se elige en el formulario: así nadie puede reportar a nombre de otro.
  @ManyToOne(() => Empleado, { nullable: false })
  @JoinColumn({ name: 'empleado_id' })
  empleado: Empleado;

  @Column()
  empleado_id: number;

  @Column({ type: 'enum', enum: TipoActividad })
  tipo_actividad: TipoActividad;

  @Column({ type: 'text' })
  descripcion: string;

  // Fecha en que se hizo el trabajo, que puede ser anterior al día en que se
  // llena el reporte (el fontanero suele registrarlo al volver a la oficina).
  // Distinta de fecha_registro, que es cuándo se guardó en el sistema.
  // `utc: true`: la conexión usa timezone 'Z', así que mysql2 lee el DATE como
  // medianoche UTC; sin esta bandera TypeORM lo reformatea con getters locales
  // y en Costa Rica (UTC-6) devolvía el día anterior.
  @Column({ type: 'date', utc: true })
  fecha_trabajo: string;

  // Tiempo empleado en minutos. Se guarda en minutos y no en horas para no
  // arrastrar decimales: "1 h 45 min" son 105, no 1.75.
  @Column({ type: 'int' })
  tiempo_minutos: number;

  // Avería que originó el trabajo, si aplica. Opcional: no toda actividad
  // viene de una avería reportada (una instalación o un mantenimiento
  // programado, por ejemplo).
  @ManyToOne(() => Averia, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'averia_id' })
  averia: Averia | null;

  @Column({ type: 'int', nullable: true })
  averia_id: number | null;

  // Labor adicional que originó el trabajo, si aplica. Un reporte se vincula a
  // una avería O a una labor (o a ninguna), no a ambas.
  @ManyToOne(() => LaborAdicional, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'labor_id' })
  labor: LaborAdicional | null;

  @Column({ type: 'int', nullable: true })
  labor_id: number | null;

  @OneToMany(() => MaterialReporteFontanero, (material) => material.reporte)
  materiales: MaterialReporteFontanero[];

  // Materiales usados escritos en texto libre por el fontanero. Los reportes
  // antiguos pueden traer tanto este campo como la tabla de materiales
  // vinculados a inventario; los nuevos solo este texto.
  @Column({ type: 'text', nullable: true })
  materiales_texto: string | null;

  // Evidencia opcional del trabajo (una imagen). Se guarda la URL de
  // Cloudinary, su public_id (para poder borrarla/reemplazarla) y el nombre
  // original del archivo.
  @Column({ type: 'varchar', length: 500, nullable: true })
  evidencia_url: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  evidencia_public_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  evidencia_nombre: string | null;

  // Cuántas veces se reenvió este reporte tras un rechazo. Se reutiliza la
  // misma fila del reporte en vez de crear duplicados.
  @Column({ type: 'int', default: 0 })
  reintentos: number;

  // Revisión de la administración sobre la resolución de la avería vinculada.
  // Los reportes sin avería también lo llevan, pero no tienen resolución que
  // aprobar; ahí sirve solo como sello de conformidad.
  @Column({
    type: 'enum',
    enum: EstadoRevisionReporte,
    default: EstadoRevisionReporte.PENDIENTE,
  })
  estado_revision: EstadoRevisionReporte;

  @CreateDateColumn()
  fecha_registro: Date;
}
