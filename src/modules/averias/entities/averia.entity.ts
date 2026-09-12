import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Empleado } from '../../empleados/entities/empleado.entity';
import { HistorialAveria } from './historial-averia.entity';

@Entity('averias')
export class Averia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  codigo_averia: string;

  @Column({
    type: 'enum',
    enum: [
      'Fuga de agua',
      'Tubería rota',
      'Falta de presión / sin agua',
      'Contador dañado',
      'Fuga en la vía pública',
      'Otro',
      'Fuga',
      'Medidor dañado',
    ],
  })
  tipo_averia: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({
    type: 'enum',
    enum: ['Pendiente', 'En proceso', 'Finalizado'],
    default: 'Pendiente',
  })
  estado: string;

  @Column()
  cedula_reportante: string;

  @Column()
  nombre_reportante: string;

  @Column({ nullable: true })
  apellido1_reportante: string;

  @Column({ nullable: true })
  apellido2_reportante: string;

  @CreateDateColumn()
  fecha_reporte: Date;

  @ManyToOne(() => Empleado, { nullable: true })
  @JoinColumn({ name: 'id_empleado' })
  empleado: Empleado | null;

  @OneToMany(() => HistorialAveria, (h) => h.averia)
  historial: HistorialAveria[];
}
