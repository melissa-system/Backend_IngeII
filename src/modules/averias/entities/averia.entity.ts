import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Empleado } from '../../empleados/entities/empleado.entity';
import { HistorialAveria } from './historial-averia.entity';

@Entity('averias')
@Index(['estado'])
@Index(['tipo_averia'])
@Index(['fecha_reporte'])
@Index(['cedula_reportante'])
export class Averia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  codigo_averia: string;

  @Column({
    type: 'enum',
    enum: [
      'Fuga en vía pública',
      'Fuga en domicilio',
      'Falta de presión / sin agua',
      'Medidor dañado',
      'Otro',
      'Fuga de agua',
      'Tubería rota',
      'Contador dañado',
      'Fuga en la vía pública',
      'Fuga',
    ],
  })
  tipo_averia: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({
    type: 'enum',
    enum: ['Pendiente', 'En proceso', 'En revisión', 'Finalizado'],
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

  // Cronómetro de la gestión del fontanero: cuándo empezó a atender la avería
  // y cuándo terminó. Ambos nullable porque una avería recién reportada aún no
  // tiene gestión. Se guardan del lado del servidor para que el tiempo sea real
  // aunque el fontanero recargue la página.
  @Column({ type: 'datetime', nullable: true })
  gestion_iniciada_en: Date | null;

  @Column({ type: 'datetime', nullable: true })
  gestion_finalizada_en: Date | null;

  // Marca de devolución: la administración rechazó la resolución del reporte y
  // la avería vuelve a manos del fontanero. `motivo_revision` guarda el porqué
  // para mostrárselo. Se limpian al volver a atender la avería o al aprobarla.
  @Column({ type: 'boolean', default: false })
  devuelta_revision: boolean;

  @Column({ type: 'text', nullable: true })
  motivo_revision: string | null;

  @ManyToOne(() => Empleado, { nullable: true })
  @JoinColumn({ name: 'id_empleado' })
  empleado: Empleado | null;

  @OneToMany(() => HistorialAveria, (h) => h.averia)
  historial: HistorialAveria[];
}
