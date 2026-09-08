import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';
import { RoleEntity } from './role.entity';

@Entity('usuarios')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  // Nombre para mostrar en vez del correo (sidebar, header, lista de
  // Usuarios). Opcional: mientras no se defina, el frontend sigue
  // derivándolo del correo (ver mapearUsuario en AuthContext.tsx).
  @Column({ type: 'varchar', length: 30, unique: true, nullable: true })
  username: string | null;

  @Column()
  password: string;

  // Única fuente de verdad del rol del usuario (antes coexistía con una
  // columna enum `role` redundante; se quitó tras el backfill de role_id).
  // nullable:false porque todo usuario existente ya tiene role_id asignado
  // (ver backfill-role-ids.ts) y todo usuario nuevo debe recibir uno al
  // crearse (ver AuthService.registrar y seed-admin.ts).
  @ManyToOne(() => RoleEntity, (role) => role.users, { nullable: false, eager: true })
  @JoinColumn({ name: 'role_id' })
  role: RoleEntity;

  @Column({ default: true })
  isActive: boolean;

  /** URL relativa de la foto de perfil (uploads/usuarios/...) */
  @Column({ type: 'varchar', length: 500, nullable: true })
  foto_url: string | null;

    // Identificador del archivo en Cloudinary, necesario para poder eliminar
  // la foto anterior al reemplazarla. NULL en usuarios cuya foto todavía
  // vive en disco (uploads/usuarios/), anteriores a la migración.
  @Column({ type: 'varchar', length: 255, nullable: true })
  foto_public_id: string | null;

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.usuario)
  refreshTokens: RefreshToken[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}