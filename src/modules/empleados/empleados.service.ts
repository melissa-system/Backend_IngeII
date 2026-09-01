import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Empleado } from './entities/empleado.entity';
import { User } from '../auth/entities/user.entity';

export interface EmpleadoPlano {
  id: number;
  nombre: string;
  cedula: string;
  puesto: string;
  telefono: string;
  fecha_ingreso: string;
  estado: string;
  fecha_registro: Date;
  usuario_id: number | null;
  email: string | null;
}

@Injectable()
export class EmpleadosService {
  constructor(
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private aPlano(emp: Empleado): EmpleadoPlano {
    return {
      id: emp.id,
      nombre: emp.nombre,
      cedula: emp.cedula,
      puesto: emp.puesto,
      telefono: emp.telefono,
      fecha_ingreso: emp.fecha_ingreso,
      estado: emp.estado,
      fecha_registro: emp.fecha_registro,
      usuario_id: emp.usuario?.id ?? null,
      email: emp.correo ?? emp.usuario?.email ?? null,
    };
  }

  async crear(datos: {
    nombre: string;
    cedula: string;
    puesto: string;
    telefono: string;
    fecha_ingreso: string;
    usuario_id?: number;
    email?: string;
  }): Promise<EmpleadoPlano> {
    const cedulaExistente = await this.empleadoRepository.findOne({
      where: { cedula: datos.cedula },
    });
    if (cedulaExistente) {
      throw new BadRequestException(
        `Ya existe un empleado con la cédula ${datos.cedula}`,
      );
    }

    const correo = datos.email?.trim().toLowerCase() ?? null;

    let usuario: User | null = null;
    if (datos.usuario_id) {
      usuario = await this.userRepository.findOne({
        where: { id: datos.usuario_id },
      });
      if (!usuario) {
        throw new BadRequestException(
          `No existe un usuario con id ${datos.usuario_id}`,
        );
      }
      await this.verificarNoVinculado(usuario);
    } else if (correo) {
      // Asocia por correo un usuario ya registrado (si existe). Si el
      // usuario aún no existe, el correo queda guardado para vincularse
      // después cuando se cree la cuenta desde el módulo de Usuarios.
      usuario = await this.userRepository.findOne({
        where: { email: correo },
      });
      if (usuario) {
        await this.verificarNoVinculado(usuario);
      }
    }

    const empleado = this.empleadoRepository.create({
      nombre: datos.nombre,
      cedula: datos.cedula,
      puesto: datos.puesto,
      telefono: datos.telefono,
      correo,
      fecha_ingreso: datos.fecha_ingreso,
      estado: 'Activo',
      usuario: usuario ?? undefined,
    });

    const guardado = await this.empleadoRepository.save(empleado);
    return this.aPlano(guardado);
  }

  private async verificarNoVinculado(usuario: User): Promise<void> {
    const yaVinculado = await this.empleadoRepository.findOne({
      where: { usuario: { id: usuario.id } },
    });
    if (yaVinculado) {
      throw new BadRequestException(
        `El usuario ${usuario.email} ya está vinculado a otro empleado`,
      );
    }
  }

  /** Busca un usuario registrado por su correo (para asociarlo a un empleado). */
  async buscarUsuarioPorEmail(email: string): Promise<{ id: number; email: string } | null> {
    const correo = email.trim().toLowerCase();
    const usuario = await this.userRepository.findOne({
      where: { email: correo },
      select: { id: true, email: true },
    });
    return usuario ?? null;
  }

  async buscar(buscar?: string): Promise<EmpleadoPlano[]> {
    const qb = this.empleadoRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.usuario', 'u');

    if (buscar) {
      const termino = `%${buscar}%`;
      qb.where(
        'e.nombre LIKE :t OR e.apellido1 LIKE :t OR e.cedula LIKE :t OR e.puesto LIKE :t OR e.telefono LIKE :t',
        { t: termino },
      );
    }

    qb.orderBy('e.nombre', 'ASC');
    const empleados = await qb.getMany();
    return empleados.map((e) => this.aPlano(e));
  }

  async obtenerPorId(id: number): Promise<EmpleadoPlano> {
    const empleado = await this.empleadoRepository.findOne({
      where: { id },
      relations: { usuario: true },
    });
    if (!empleado) {
      throw new NotFoundException(`No se encontró el empleado con id ${id}`);
    }
    return this.aPlano(empleado);
  }

  async actualizar(
    id: number,
    datos: {
      nombre?: string;
      cedula?: string;
      puesto?: string;
      telefono?: string;
      correo?: string | null;
      fecha_ingreso?: string;
      usuario_id?: number | null;
    },
  ): Promise<EmpleadoPlano> {
    const empleado = await this.empleadoRepository.findOne({
      where: { id },
      relations: { usuario: true },
    });
    if (!empleado) {
      throw new NotFoundException(`No se encontró el empleado con id ${id}`);
    }

    if (datos.cedula && datos.cedula !== empleado.cedula) {
      const duplicado = await this.empleadoRepository.findOne({
        where: { cedula: datos.cedula },
      });
      if (duplicado) {
        throw new BadRequestException(
          `Ya existe un empleado con la cédula ${datos.cedula}`,
        );
      }
    }

    if (datos.usuario_id !== undefined) {
      if (datos.usuario_id === null) {
        empleado.usuario = null;
      } else {
        const usuario = await this.userRepository.findOne({
          where: { id: datos.usuario_id },
        });
        if (!usuario) {
          throw new BadRequestException(
            `No existe un usuario con id ${datos.usuario_id}`,
          );
        }
        const yaVinculado = await this.empleadoRepository.findOne({
          where: { usuario: { id: usuario.id } },
        });
        if (yaVinculado && yaVinculado.id !== id) {
          throw new BadRequestException(
            `El usuario ${usuario.email} ya está vinculado a otro empleado`,
          );
        }
        empleado.usuario = usuario;
      }
    }

    if (datos.nombre !== undefined) empleado.nombre = datos.nombre;
    if (datos.cedula !== undefined) empleado.cedula = datos.cedula;
    if (datos.puesto !== undefined) empleado.puesto = datos.puesto;
    if (datos.telefono !== undefined) empleado.telefono = datos.telefono;
    if (datos.correo !== undefined) {
      empleado.correo = datos.correo?.trim().toLowerCase() ?? null;
    }
    if (datos.fecha_ingreso !== undefined) empleado.fecha_ingreso = datos.fecha_ingreso;

    const guardado = await this.empleadoRepository.save(empleado);
    return this.aPlano(guardado);
  }

  async cambiarEstado(
    id: number,
    estado: 'Activo' | 'Inactivo',
  ): Promise<EmpleadoPlano> {
    const empleado = await this.empleadoRepository.findOne({
      where: { id },
      relations: { usuario: true },
    });
    if (!empleado) {
      throw new NotFoundException(`No se encontró el empleado con id ${id}`);
    }

    empleado.estado = estado;
    const guardado = await this.empleadoRepository.save(empleado);
    return this.aPlano(guardado);
  }

  async listarUsuarios(): Promise<Array<{ id: number; email: string }>> {
    return this.userRepository.find({
      select: { id: true, email: true },
      order: { email: 'ASC' as const },
    });
  }
}
