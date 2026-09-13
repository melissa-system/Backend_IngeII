import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ModuloBitacora, AccionBitacora } from './bitacora.enums';
import { User } from '../../auth/entities/user.entity';

// Bitácora general de auditoría: UNA fila por cada movimiento del sistema,
// sin importar de qué módulo venga.
//
// Reemplaza a los historiales por módulo (historial_abonados,
// averias_historial), que tenían estructuras distintas entre sí y obligaban
// a consultar tabla por tabla para responder "¿qué pasó hoy en el sistema?".
//
// Los registros son INALTERABLES: no existen endpoints de edición ni
// eliminación. Una bitácora que se puede editar no sirve como auditoría.
@Entity('bitacora')
// Índices por los filtros que más se usan en el panel: por registro concreto
// ("historial de este abonado"), por módulo y por fecha.
@Index(['modulo', 'registro_id'])
@Index(['fecha'])
export class Bitacora {
  @PrimaryGeneratedColumn()
  id: number;

  // Módulo al que pertenece el registro afectado.
  @Column({ type: 'enum', enum: ModuloBitacora })
  modulo: ModuloBitacora;

  // ID del registro afectado dentro de ese módulo (el id del abonado, de la
  // solicitud, de la avería...). No es una FK: la bitácora apunta a tablas
  // distintas según el módulo, y además debe sobrevivir al borrado del
  // registro original — si se elimina un abonado, su rastro tiene que
  // quedar. Por eso es un número suelto.
  @Column()
  registro_id: number;

  @Column({ type: 'enum', enum: AccionBitacora })
  accion: AccionBitacora;

  // Usuario que ejecutó la acción. Nullable porque hay movimientos sin
  // usuario autenticado detrás (ej. una solicitud creada desde el formulario
  // público, o un script de migración).
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User | null;

  // Copia del correo del usuario al momento de la acción. Se guarda aparte
  // de la relación a propósito: si la cuenta se elimina, la relación queda
  // en NULL pero el rastro de quién lo hizo debe conservarse igual.
  @Column({ type: 'varchar', length: 255, nullable: true })
  usuario_email: string | null;

  // Campo modificado. Solo aplica a EDICION (ej. 'telefono', 'direccion');
  // en creaciones y eliminaciones va NULL, y en cambios de estado va
  // 'estado'.
  @Column({ type: 'varchar', length: 100, nullable: true })
  campo: string | null;

  // Valores antes y después del cambio, ya convertidos a texto. Se guardan
  // como texto plano (no JSON) para que la bitácora sea legible tal cual en
  // el panel, sin tener que interpretar nada.
  @Column({ type: 'text', nullable: true })
  valor_anterior: string | null;

  @Column({ type: 'text', nullable: true })
  valor_nuevo: string | null;

  // Nota libre: la razón del rechazo de una solicitud, la observación de una
  // avería, o una descripción de la acción cuando no hay campo concreto
  // (ej. "Se creó el abonado ABN-0012").
  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @CreateDateColumn()
  fecha: Date;
}