import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SolicitudMaterial } from './solicitud-material.entity';
import { Articulo } from '../../inventario/entities/articulo.entity';

// Un material pedido dentro de una solicitud.
//
// Puede venir del catálogo (articulo) o haber sido escrito a mano como
// "Otro" (descripcion_libre), porque el fontanero puede necesitar algo que
// todavía no está registrado en inventario. En ese caso, antes de aprobar, la
// administración debe vincularlo a un artículo (existente o creado en ese
// momento), para que la entrega quede respaldada por un movimiento de stock.
@Entity('solicitud_material_detalles')
export class DetalleSolicitudMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SolicitudMaterial, (solicitud) => solicitud.detalles, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'id_solicitud_material' })
  solicitud: SolicitudMaterial;

  // Nullable hasta que la administración vincula el material libre.
  @ManyToOne(() => Articulo, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_articulo' })
  articulo: Articulo | null;

  @Column({ type: 'int', nullable: true })
  id_articulo: number | null;

  // Lo que escribió el fontanero cuando el material no está en el catálogo.
  // Se conserva aun después de vincularlo, para trazabilidad.
  @Column({ type: 'varchar', length: 150, nullable: true })
  descripcion_libre: string | null;

  // Unidad libre (metros, unidad, caja...) para los materiales no inventariados.
  @Column({ type: 'varchar', length: 30, nullable: true })
  unidad: string | null;

  @Column({ type: 'int' })
  cantidad: number;
}
