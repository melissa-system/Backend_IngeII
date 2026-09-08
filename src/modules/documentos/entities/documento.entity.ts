import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {
  TipoDocumento,
  VisibilidadDocumento,
  EstadoDocumento,
} from '../enums/documento.enums';
import { Empleado } from '../../empleados/entities/empleado.entity';

// 1. Le decimos al ORM que esto se convertirá en la tabla 'documentos' en MySQL
@Entity('documentos')
export class Documento {
  // 2. Llave primaria auto-incrementable (id INT PK)
  @PrimaryGeneratedColumn()
  id: number;

  // 3. Nombre visible del documento (no es el nombre del archivo físico).
  // Ej: 'Acta de asamblea ordinaria 2026', 'Informe de medición marzo 2026'.
  @Column({ length: 150 })
  nombre: string;

  // 4. Catálogo cerrado de tipos de documento (ver documento.enums.ts).
  // La columna 'enum' de MySQL ya rechaza cualquier valor fuera de esta lista,
  // y el service valida lo mismo antes de llegar a la base de datos para dar
  // un mensaje de error claro en vez de un error crudo de SQL.
  @Column({ type: 'enum', enum: TipoDocumento })
  tipo: TipoDocumento;

  // 5. Número de versión del documento. Empieza en 1. Al cargar un archivo
  // nuevo con el mismo nombre y tipo, la versión anterior pasa a
  // 'Inhabilitado' y la nueva queda como vigente con version + 1
  // (ver DocumentosService.create).
  @Column({ type: 'int', default: 1 })
  version: number;

  // 6. URL del archivo en Cloudinary (secure_url). Antes de la migración a la
  // nube esta columna guardaba el nombre del archivo dentro de
  // uploads/documentos/; los registros viejos conservan ese valor y siguen
  // sirviéndose desde disco (ver README de la Task B3).
  @Column({ length: 500 })
  ubicacion: string;

  // 6b. Identificador del archivo dentro de Cloudinary, necesario para poder
  // eliminarlo al reemplazarlo (Task B4). NULL en los registros anteriores a
  // la migración, que viven en disco y no tienen public_id.
  @Column({ type: 'varchar', length: 255, nullable: true })
  public_id: string | null;

  // 7. Público: visible para cualquier persona. Interno: solo dashboard
  // administrativo. 'Interno' por defecto para no exponer nada sin querer.
  @Column({
    type: 'enum',
    enum: VisibilidadDocumento,
    default: VisibilidadDocumento.INTERNO,
  })
  visibilidad: VisibilidadDocumento;

  // 8. Vigente: es la versión actual/activa del documento. Inhabilitado:
  // versión reemplazada por una más nueva, o dada de baja manualmente.
  // Se conserva el registro para no perder el historial.
  @Column({
    type: 'enum',
    enum: EstadoDocumento,
    default: EstadoDocumento.VIGENTE,
  })
  estado: EstadoDocumento;

  // 9. Fecha y hora automática en la que se cargó este documento/versión
  @CreateDateColumn()
  fecha_carga: Date;

  // 10. Empleado que subió este documento/versión. Apunta a empleados (no a
  // usuarios), igual que publicaciones.empleado — se resuelve desde el
  // usuario autenticado vía EmpleadosService.buscarPorUsuarioId. Nullable:
  // si esa cuenta no tiene empleado vinculado, o si el documento se creó
  // antes de este cambio o por un script de migración de datos.
  @ManyToOne(() => Empleado, { nullable: true })
  @JoinColumn({ name: 'id_empleado' })
  empleado: Empleado | null;
}