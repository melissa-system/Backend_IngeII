import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Abonado } from './abonado.entity';

// Datos exclusivos de un abonado tipo 'Jurídica'. 1 fila por abonado
// jurídica (relación 1:1, el FK vive en esta tabla vía @JoinColumn).
@Entity('abonados_juridicos')
export class AbonadoJuridico {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Abonado, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'abonado_id' })
  abonado: Abonado;

  @Column({ nullable: true })
  nombre_representante_legal: string | null;

  // Campo nuevo (no existía antes en abonados): queda NULL para los
  // jurídicos que ya existían antes de esta migración, hay que
  // completarlo a mano.
  @Column({ nullable: true })
  cedula_representante: string | null;
}
