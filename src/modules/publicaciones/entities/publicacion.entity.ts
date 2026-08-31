import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

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

  // 8. Usuario autenticado que creó la publicación. Apunta a usuarios (no a
  // empleados), mismo criterio que documentos.subido_por: solo interesa
  // qué cuenta la creó. Nullable por publicaciones creadas antes de este
  // cambio o sin usuario autenticado detrás.
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'autor_id' })
  autor: User | null;
}
