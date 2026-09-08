import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

// Tokens de un solo uso para recuperación de contraseña. En la BD se guarda
// únicamente el SHA-256 del token; el valor plano solo existe en el correo
// enviado al usuario (nunca se persiste en texto plano).
@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn()
  id: number;

  // SHA-256 en hexadecimal (64 caracteres)
  @Column({ length: 64, unique: true })
  token_hash: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @Column({ name: 'usuario_id' })
  usuario_id: number;

  // 'datetime' (no 'timestamp'): las columnas TIMESTAMP de MySQL se
  // reinterpretan según el time_zone de la SESIÓN al guardar y al leer,
  // lo cual seguía provocando que este token (vigencia de solo 30 min)
  // apareciera "expirado" casi de inmediato, aun con timezone:'Z' en la
  // conexión (esa opción solo controla la conversión Date<->string de
  // mysql2, no la reinterpretación que hace MySQL para TIMESTAMP).
  // 'datetime' guarda el valor literal, sin reinterpretación: combinado
  // con que la app siempre calcula expiresAt en UTC (Date.now()), queda
  // consistente con NOW() sin depender del time_zone de la sesión.
  @Column({ type: 'datetime' })
  expires_at: Date;

  // Fecha en que se usó el token para cambiar la contraseña. NULL = vigente
  // y no usado todavía. La task de "confirmar reset" (pendiente) la llenará.
  @Column({ type: 'datetime', nullable: true })
  used_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}