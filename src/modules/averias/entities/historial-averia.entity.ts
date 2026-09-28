import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Averia } from './averia.entity';

@Entity('averias_historial')
export class HistorialAveria {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Averia, (averia) => averia.historial, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'averia_id' })
  averia: Averia;

  @Column()
  averia_id: number;

  @Column({ nullable: true })
  estado_anterior: string;

  @Column()
  estado_nuevo: string;

  @Column()
  realizado_por: string;

  @Column({ type: 'text', nullable: true })
  observacion: string;

  @CreateDateColumn()
  fecha: Date;
}
