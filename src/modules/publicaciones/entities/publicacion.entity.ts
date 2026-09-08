import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Empleado } from '../../empleados/entities/empleado.entity';

// 1. Le decimos al ORM que esto se convertirá en la tabla 'publicaciones' en MySQL
@Entity('publicaciones')
export class Publicacion {
  // 2. Llave primaria auto-incrementable (id INT PK)
  @PrimaryGeneratedColumn()
  id: number;

  // 3. Título de la noticia/comunicado/aviso. Limitado para que la tarjeta
  // del landing y del dashboard no se desacomode.
  @Column({ length: 120 })
  titulo: string;

  // 4. Cuerpo/resumen de la publicación. Limitado por la misma razón que el título.
  @Column({ length: 400 })
  contenido: string;

  // 5. Categoría libre (Ej: 'Aviso', 'Comunicado', 'Mantenimiento').
  // No se restringe a un enum fijo para no limitar al personal administrativo.
  @Column({ length: 40 })
  categoria: string;

  // 6. Controla si se muestra en el landing público. Activa por defecto al crearse.
  @Column({ default: true })
  publicado: boolean;

  // 7. Fecha y hora automática en la que se registra la publicación en MySQL
  @CreateDateColumn()
  fecha_publicacion: Date;

  // 8. Empleado que creó la publicación. Apunta a empleados (no a usuarios):
  // interesa identificar a la persona de personal, no solo la cuenta con la
  // que inició sesión (mismo criterio unificado en documentos, averías,
  // configuración y solicitudes — todos usan id_empleado). Se resuelve a
  // partir del usuario autenticado vía EmpleadosService.buscarPorUsuarioId;
  // queda null si esa cuenta todavía no tiene un empleado vinculado, o para
  // publicaciones creadas antes de este cambio.
  @ManyToOne(() => Empleado, { nullable: true })
  @JoinColumn({ name: 'id_empleado' })
  empleado: Empleado | null;
}
