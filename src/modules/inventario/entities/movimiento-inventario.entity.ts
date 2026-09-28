import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Articulo } from './articulo.entity';

@Entity('movimientos_inventario')
export class MovimientoInventario {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Articulo, (articulo) => articulo.movimientos, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'articulo_id' })
  articulo: Articulo;

  @Column({ type: 'varchar', length: 50 })
  tipo_movimiento: 'entrada' | 'salida';

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  responsable_destino: string | null;

  @Column({ type: 'varchar', length: 255 })
  motivo: string;

  @Column({ type: 'int', nullable: true })
  usuario_id: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  nombre_persona_registro: string | null;

  @CreateDateColumn({ name: 'fecha_movimiento' })
  fecha_movimiento: Date;
}

