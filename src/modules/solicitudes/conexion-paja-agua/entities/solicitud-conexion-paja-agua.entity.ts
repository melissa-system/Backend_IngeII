import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Solicitud } from '../../common/entities/solicitud.entity';
import { SolicitudPajaAgua } from '../../paja-agua/entities/solicitud-paja-agua.entity';

// Un adjunto de la solicitud de conexión: el set de documentos requeridos
// varía según la naturaleza del inmueble y el tipo de trámite (ver sección
// VII del formulario GNU-42-01-F1), así que en vez de una columna por
// documento posible se guarda como lista en JSON.
export interface AdjuntoConexion {
  tipo: string; // clave interna (ej: 'identificacion', 'plano_agrimensura')
  etiqueta: string; // texto legible para mostrar en el detalle/documento
  url: string;
  publicId: string;
}

// "Segunda parte" del trámite de paja de agua: la Solicitud de conexión de
// servicio (formulario GNU-42-01-F1 de AyA), que un Abonado puede iniciar
// desde su propio dashboard SOLO después de que su solicitud original de
// paja de agua fue Aprobada (ahí se crea el Abonado que la habilita).
//
// Sigue el mismo patrón que las demás solicitudes del sistema: una fila en
// la tabla genérica `solicitudes` (estado, abonado, empleado, código) más
// esta tabla hija con los campos propios del trámite.
@Entity('solicitud_conexion_paja_agua')
export class SolicitudConexionPajaAgua {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Solicitud, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_solicitud' })
  solicitud: Solicitud;

  // Solicitud de paja de agua original que habilitó este trámite. Relación
  // 1:1: cada solicitud de paja de agua Aprobada admite como máximo una
  // solicitud de conexión.
  @OneToOne(() => SolicitudPajaAgua)
  @JoinColumn({ name: 'id_solicitud_paja_agua' })
  solicitudPajaAgua: SolicitudPajaAgua;

  // II. Medio para notificación (principal y secundario, a elección del
  // solicitante entre fax, correo electrónico o dirección física)
  @Column({ type: 'enum', enum: ['fax', 'correo', 'direccion'] })
  medio_notificacion_principal: string;

  @Column({ type: 'varchar', length: 255 })
  valor_notificacion_principal: string;

  @Column({
    type: 'enum',
    enum: ['fax', 'correo', 'direccion'],
    nullable: true,
  })
  medio_notificacion_secundario: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  valor_notificacion_secundario: string | null;

  // III. Información adicional del inmueble (la ubicación, naturaleza y
  // calidad del titular ya viven en la solicitud de paja de agua original)
  @Column({ type: 'varchar', length: 100, nullable: true })
  folio_real: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  plano_catastro: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  plano_agrimensura: string | null;

  @Column({ type: 'varchar', length: 100 })
  numero_disponibilidad: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  numero_nis: string | null;

  // IV. Propósito de la solicitud
  @Column({
    type: 'enum',
    enum: ['agua_potable', 'alcantarillado_sanitario', 'ambos'],
  })
  servicio_solicitado: string;

  @Column({
    type: 'enum',
    enum: [
      'nueva_conexion',
      'individualizacion',
      'independizacion',
      'traslado',
      'servicio_provisional_proyectos',
      'cambio_diametro',
      'servicio_temporal',
    ],
  })
  tipo_tramite: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  codigo_apc_cfia: string | null;

  @Column({
    type: 'enum',
    enum: ['efectivo_previo', 'incluir_primera_facturacion'],
  })
  forma_pago: string;

  // V. Firma del solicitante (capturada con canvas y subida como imagen)
  @Column({ type: 'varchar', length: 255 })
  nombre_firmante: string;

  @Column({ type: 'varchar', length: 50 })
  identificacion_firmante: string;

  @Column({ type: 'varchar', length: 500 })
  firma_path: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  firma_public_id: string | null;

  // VII. Requisitos: set de documentos adjuntos, dinámico según el caso.
  @Column({ type: 'json', nullable: true })
  adjuntos: AdjuntoConexion[] | null;

  @Column({ type: 'text', nullable: true })
  motivo_rechazo: string | null;
}
