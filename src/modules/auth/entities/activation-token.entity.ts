import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

// Tokens de un solo uso para activar la cuenta tras el registro. En la BD
// se guarda únicamente el SHA-256 del token; el valor plano solo existe en
// el correo de bienvenida enviado al usuario.
@Entity('activation_tokens')
export class ActivationToken {
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
  // en password-reset-token.entity.ts.
  @Column({ type: 'datetime', nullable: true })
  expires_at: Date | null;

  // Fecha en que se usó el token para activar la cuenta. NULL = vigente y
  // no usado todavía. Evita que el mismo token active la cuenta dos veces.
  @Column({ type: 'datetime', nullable: true })
  used_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}