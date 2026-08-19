import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

// 1. Le decimos al ORM que esto se convertirá en la tabla 'publicaciones' en MySQL
@Entity('publicaciones')
export class Publicacion {
  // 2. Llave primaria auto-incrementable (id INT PK)
  @PrimaryGeneratedColumn()
  id: number;

  // 3. Título de la noticia/comunicado/aviso
  @Column()
  titulo: string;

  // 4. Cuerpo/resumen de la publicación (TEXT)
  @Column({ type: 'text' })
  contenido: string;

  // 5. Categoría libre (Ej: 'Aviso', 'Comunicado', 'Mantenimiento').
  // No se restringe a un enum fijo para no limitar al personal administrativo.
  @Column()
  categoria: string;

  // 6. Controla si se muestra en el landing público. Activa por defecto al crearse.
  @Column({ default: true })
  publicado: boolean;

  // 7. Fecha y hora automática en la que se registra la publicación en MySQL
  @CreateDateColumn()
  fecha_publicacion: Date;
}
