import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Empleado } from './entities/empleado.entity';
import { User } from '../auth/entities/user.entity';
import { Abonado } from '../abonados/entities/abonado.entity';
import { AuthService } from '../auth/auth.service';
import { Role } from '../../common/enums/roles.enum';

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
  usuario_email: string | null;
  email: string | null;
}

@Injectable()
export class EmpleadosService {
  constructor(
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Abonado)
    private readonly abonadoRepository: Repository<Abonado>,
    private readonly authService: AuthService,
  ) {}

  // La cédula se trata como única en todo el sistema (Empleados + Abonados),
  // SALVO que se confirme explícitamente que es la misma persona (mismo
  // criterio simétrico que AbonadosService.create) — ej. alguien de la
  // Junta que también es abonado.
  private async verificarCedulaNoUsadaPorAbonado(
    cedula: string,
    confirmar?: boolean,
  ): Promise<void> {
    if (confirmar) return;
    const abonado = await this.abonadoRepository.findOneBy({ cedula });
    if (abonado) {
      throw new BadRequestException({
        requiereConfirmacion: true,
        tipo: 'abonado',
        registro: { id: abonado.id, nombre: abonado.nombre },
        message: `La cédula ${cedula} ya está registrada como abonado (${abonado.nombre}). Si es la misma persona, confirmá para registrarla también como empleado.`,
      });
    }
  }

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
      usuario_email: emp.usuario?.email ?? null,
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
    confirmarVinculacion?: boolean;
  }): Promise<EmpleadoPlano> {
    const cedulaExistente = await this.empleadoRepository.findOne({
      where: { cedula: datos.cedula },
    });
    if (cedulaExistente) {
      throw new BadRequestException(
        `Ya existe un empleado con la cédula ${datos.cedula}`,
      );
    }
    await this.verificarCedulaNoUsadaPorAbonado(
      datos.cedula,
      datos.confirmarVinculacion,
    );

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

  // Dirección inversa a la anterior: a partir del id de la cuenta que hace
  // la petición (req.user.id, siempre un usuario_id) resuelve el Empleado
  // vinculado, para poblar el campo id_empleado en Publicaciones, Documentos,
  // Configuración, etc. Devuelve null si esa cuenta todavía no tiene un
  // empleado vinculado (ver crear/actualizar más arriba) — en ese caso el
  // registro que se está creando queda sin autoría, no se bloquea por eso.
  async buscarPorUsuarioId(usuarioId: number): Promise<Empleado | null> {
    return this.empleadoRepository.findOne({
      where: { usuario: { id: usuarioId } },
    });
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
      confirmarVinculacion?: boolean;
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
      await this.verificarCedulaNoUsadaPorAbonado(
        datos.cedula,
        datos.confirmarVinculacion,
      );
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

  // El rol de la cuenta de acceso que se crea para un empleado se deriva
  // de su puesto; si el puesto no está mapeado no se crea la cuenta (mejor
  // que inventar un rol incorrecto) y se avisa al administrador.
  private rolParaPuesto(puesto: string): Role {
    switch (puesto) {
      case 'Junta Directiva':
        return Role.SUPER_ADMIN;
      case 'Administrador':
        return Role.ADMIN;
      case 'Fontanero':
        return Role.FONTANERO;
      case 'Abonado':
        return Role.ABONADO;
      default:
        throw new BadRequestException(
          `No se puede crear la cuenta de acceso: no hay un rol definido para el puesto "${puesto}".`,
        );
    }
  }

  // Vincula (o crea si no existe) la cuenta de acceso del empleado usando
  // su correo. La cuenta se crea con el rol que corresponda a su puesto.
  async vincularCuenta(id: number): Promise<{
    mensaje: string;
    empleado: EmpleadoPlano;
  }> {
    const empleado = await this.empleadoRepository.findOne({
      where: { id },
      relations: { usuario: true },
    });
    if (!empleado) {
      throw new NotFoundException(`No se encontró el empleado con id ${id}`);
    }

    if (empleado.usuario) {
      throw new BadRequestException(
        `El empleado ${empleado.nombre} ya tiene una cuenta de acceso vinculada (${empleado.usuario.email}).`,
      );
    }

    const correo = empleado.correo?.trim().toLowerCase();
    if (!correo) {
      throw new BadRequestException(
        `El empleado ${empleado.nombre} no tiene correo guardado. Primero guarda el correo en el formulario y vuelve a intentar.`,
      );
    }

    const yaVinculado = await this.empleadoRepository.findOne({
      where: { usuario: { email: correo } },
    });
    if (yaVinculado && yaVinculado.id !== id) {
      throw new BadRequestException(
        `El correo ${correo} ya está vinculado a otro empleado (${yaVinculado.nombre}).`,
      );
    }

    await this.authService.crearCuentaParaEmpleado(
      empleado,
      this.rolParaPuesto(empleado.puesto),
    );

    const actualizado = await this.obtenerPorId(id);
    return {
      mensaje: `Cuenta de acceso vinculada al empleado ${actualizado.nombre}.`,
      empleado: actualizado,
    };
  }

  async listarUsuarios(): Promise<Array<{ id: number; email: string }>> {
    return this.userRepository.find({
      select: { id: true, email: true },
      order: { email: 'ASC' as const },
    });
  }
}
