import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany } from 'typeorm';
import { RoleEntity } from './role.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string; // Ej: "averias.crear", "inventario.ver", "usuarios.gestionar"

  @Column({ nullable: true })
  description: string;

  @ManyToMany(() => RoleEntity, (role: RoleEntity) => role.permissions)
  roles: RoleEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}