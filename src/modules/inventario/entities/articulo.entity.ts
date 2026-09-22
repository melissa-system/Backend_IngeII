import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Proveedor } from './proveedor.entity';
import { MovimientoInventario } from './movimiento-inventario.entity';

@Entity('articulos')
export class Articulo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'varchar', length: 50, default: 'articulo' })
  clasificacion: 'inmueble' | 'articulo';

  @Column({ type: 'int', default: 0 })
  cantidad_disponible: number;

  @Column({ type: 'int', default: 5 })
  umbral_minimo: number;

  @Column({ type: 'date', default: () => '(CURRENT_DATE)' })
  fecha_ingreso: string;

  @Column({ type: 'varchar', length: 255 })
  ubicacion: string;

  @Column({ type: 'varchar', length: 150 })
  persona_recibe: string;

  @Column({ type: 'varchar', length: 50, default: 'activo' })
  estado: 'activo' | 'inactivo';

  @ManyToOne(() => Proveedor, (proveedor) => proveedor.articulos, {
    nullable: false,
    eager: true,
  })
  @JoinColumn({ name: 'proveedor_id' })
  proveedor: Proveedor;

  @OneToMany(() => MovimientoInventario, (mov) => mov.articulo)
  movimientos: MovimientoInventario[];

  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fecha_actualizacion: Date;
}

