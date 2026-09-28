import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Articulo } from '../../inventario/entities/articulo.entity';
import { ReporteFontanero } from './reporte-fontanero.entity';

// Un material usado en un reporte. Es una tabla aparte (y no columnas fijas)
// porque un mismo trabajo puede llevar uno o diez materiales distintos, y así
// agregar uno más no obliga a migrar la base de datos.
@Entity('materiales_reporte_fontanero')
export class MaterialReporteFontanero {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ReporteFontanero, (reporte) => reporte.materiales, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reporte_id' })
  reporte: ReporteFontanero;

  @Column()
  reporte_id: number;

  // El artículo puede darse de baja del inventario más adelante; el reporte
  // histórico debe seguir siendo legible, así que la relación queda en NULL y
  // el nombre se conserva en la copia de abajo.
  @ManyToOne(() => Articulo, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'articulo_id' })
  articulo: Articulo | null;

  @Column({ type: 'int', nullable: true })
  articulo_id: number | null;

  // Copia del nombre del artículo al momento de usarlo: si después lo
  // renombran o lo eliminan, el reporte sigue diciendo qué se ocupó.
  @Column({ type: 'varchar', length: 150 })
  nombre_articulo: string;

  @Column({ type: 'int' })
  cantidad: number;
}
