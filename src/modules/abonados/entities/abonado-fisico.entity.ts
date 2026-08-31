import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Abonado } from './abonado.entity';

// Datos exclusivos de un abonado tipo 'Física'. 1 fila por abonado física
// (relación 1:1, el FK vive en esta tabla vía @JoinColumn).
@Entity('abonados_fisicos')
export class AbonadoFisico {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Abonado, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'abonado_id' })
  abonado: Abonado;

  // Apellidos por separado (ver instrucción de Meli de no guardar nombres
  // completos como un solo campo). Quedan NULL para los abonados física
  // que ya existían antes de esta migración: no hay forma segura de
  // partir automáticamente el nombre_completo viejo sin arriesgarse a
  // cortar mal un nombre compuesto o un apellido con "de/del/de la" — hay
  // que completarlos a mano para esos registros.
  @Column({ nullable: true })
  apellido1: string | null;

  @Column({ nullable: true })
  apellido2: string | null;

  @Column({ nullable: true })
  numero_plano_catastrado: string | null;
}
