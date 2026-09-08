import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

// Tokens de sesión de larga duración. En la BD se guarda únicamente el
// SHA-256 del token; el valor plano solo existe en la cookie httpOnly.
@Entity('refresh_tokens')
export class RefreshToken {
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

  // 'datetime' (no 'timestamp') + nullable: ver el comentario equivalente
  // en password-reset-token.entity.ts. Con 7 días de vigencia este token
  // absorbía el desfase de zona horaria sin notarse, pero tenía el mismo
  // riesgo de fondo (y fue el que de hecho volvió a fallar el ALTER).
  @Column({ type: 'datetime', nullable: true })
  expires_at: Date | null;

  // Fecha de revocación (logout o rotación). NULL = token vigente.
  @Column({ type: 'datetime', nullable: true })
  revoked_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
