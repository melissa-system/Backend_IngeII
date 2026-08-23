import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Role } from '../../../common/enums/roles.enum';
import { RefreshToken } from './refresh-token.entity';
import { RoleEntity } from './role.entity';

@Entity('usuarios')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.ABONADO,
  })
  role: Role;

  @ManyToOne(() => RoleEntity, (roleEntity) => roleEntity.users, { nullable: true, eager: true })
  @JoinColumn({ name: 'role_id' })
  roleEntity: RoleEntity;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.usuario)
  refreshTokens: RefreshToken[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}