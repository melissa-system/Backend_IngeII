import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Abonado } from './abonado.entity';

// Un registro por cada campo modificado en PATCH /abonados/:id.
@Entity('historial_abonados')
@Index(['abonado'])
export class HistorialAbonado {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Abonado, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'abonado_id' })
  abonado: Abonado;

  @Column({ length: 255 })
  usuario_email: string;

  @Column({ length: 100 })
  campo: string;

  @Column({ type: 'text', nullable: true })
  valor_anterior: string | null;

  @Column({ type: 'text', nullable: true })
  valor_nuevo: string | null;

  @CreateDateColumn()
  fecha: Date;
}
