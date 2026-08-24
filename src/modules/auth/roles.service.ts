import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RoleEntity } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  // Listar todos los roles con sus permisos asociados
  async findAllRoles(): Promise<RoleEntity[]> {
    return this.roleRepository.find({
      relations: {
        permissions: true,
      },
      order: { id: 'ASC' },
    });
  }

  // Crear un nuevo rol con validación de nombre único
  async createRole(createRoleDto: CreateRoleDto): Promise<RoleEntity> {
    const existe = await this.roleRepository.findOne({
      where: { name: createRoleDto.name },
    });
    if (existe) {
      throw new ConflictException('Ya existe un rol con ese nombre');
    }

    const role = this.roleRepository.create(createRoleDto);
    return this.roleRepository.save(role);
  }

  // Editar un rol existente
  async updateRole(id: number, updateDto: CreateRoleDto): Promise<RoleEntity> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (updateDto.name && updateDto.name !== role.name) {
      const duplicado = await this.roleRepository.findOne({
        where: { name: updateDto.name },
      });
      if (duplicado) {
        throw new ConflictException('Ya existe otro rol con ese nombre');
      }
    }

    role.name = updateDto.name;
    role.description = updateDto.description ?? role.description;
    return this.roleRepository.save(role);
  }

  // Eliminar rol con validación de integridad (no eliminar si tiene usuarios asignados)
  async deleteRole(id: number): Promise<{ message: string }> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: {
        users: true,
      },
    });

    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (role.users && role.users.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar el rol porque tiene usuarios asignados. Reasígnelos antes de continuar.',
      );
    }

    await this.roleRepository.remove(role);
    return { message: 'Rol eliminado exitosamente' };
  }

  // Asignar o remover permisos específicos a un rol y retornar la lista actualizada
  async assignPermissionsToRole(
    roleId: number,
    assignDto: AssignPermissionsDto,
  ): Promise<RoleEntity> {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: {
        permissions: true,
      },
    });

    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    const permissions = await this.permissionRepository.findBy({
      id: In(assignDto.permissionIds),
    });

    if (permissions.length !== assignDto.permissionIds.length) {
      throw new BadRequestException('Uno o más identificadores de permisos no son válidos');
    }

    role.permissions = permissions;
    return this.roleRepository.save(role);
  }

  // Listar catálogo completo de permisos
  async findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepository.find({ order: { name: 'ASC' } });
  }
}