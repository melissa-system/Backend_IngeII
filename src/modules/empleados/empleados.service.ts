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
import { BitacoraService } from '../bitacora/bitacora.service';
import {
  ModuloBitacora,
  AccionBitacora,
} from '../bitacora/entities/bitacora.enums';

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

// Campos del empleado que se auditan al editar. usuario_id no está acá: la
// vinculación de cuenta se registra aparte, con el correo en vez del id, que
// es lo que le sirve a quien lee la bitácora.
const CAMPOS_AUDITABLES = [
  'nombre',
  'cedula',
  'puesto',
  'telefono',
  'correo',
  'fecha_ingreso',
];

@Injectable()
export class EmpleadosService {
  // OJO con el orden: cada @InjectRepository() aplica al parámetro que tiene
  // INMEDIATAMENTE debajo. Los servicios no llevan decorador y van agrupados
  // al final, para no quedar pegados a un @InjectRepository ajeno.
  constructor(
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Abonado)
    private readonly abonadoRepository: Repository<Abonado>,
    private readonly authService: AuthService,
    private readonly bitacoraService: BitacoraService,
  ) {}

  // Autor de un movimiento para la bitácora. RequestUser solo trae el id, así
  // que el correo se busca en la BD: la bitácora lo guarda para conservar
  // quién hizo la acción aunque después se elimine la cuenta.
  private async autorDe(usuarioId?: number) {
    if (!usuarioId) return null;
    const usuario = await this.userRepository.findOneBy({ id: usuarioId });
    return { id: usuarioId, email: usuario?.email ?? null };
  }

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

  async crear(
    datos: {
      nombre: string;
      cedula: string;
      puesto: string;
      telefono: string;
      fecha_ingreso: string;
      usuario_id?: number;
      email?: string;
      confirmarVinculacion?: boolean;
    },
    autorId?: number,
  ): Promise<EmpleadoPlano> {
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

    const autor = await this.autorDe(autorId);
    if (autor) {
      await this.bitacoraService.registrarCreacion(
        ModuloBitacora.EMPLEADOS,
        guardado.id,
        autor,
        `Empleado ${guardado.nombre} registrado como ${guardado.puesto}${
          usuario ? ` (cuenta vinculada: ${usuario.email})` : ''
        }`,
      );
    }

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
    autorId?: number,
  ): Promise<EmpleadoPlano> {
    const empleado = await this.empleadoRepository.findOne({
      where: { id },
      relations: { usuario: true },
    });
    if (!empleado) {
      throw new NotFoundException(`No se encontró el empleado con id ${id}`);
    }

    // Copia de los valores ANTES de modificar nada: después de las
    // asignaciones de abajo el original se pierde y ya no se puede comparar.
    const antes = { ...empleado } as Record<string, unknown>;
    const correoCuentaAntes = empleado.usuario?.email ?? null;

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

    const autor = await this.autorDe(autorId);
    if (autor) {
      // Se compara contra el empleado YA modificado (no contra `datos`),
      // porque el correo se normaliza a minúsculas antes de guardar: comparar
      // contra lo que mandó el formulario registraría como cambio un
      // "Juan@x.com" → "juan@x.com" que en realidad no cambió nada.
      const cambios = BitacoraService.compararCampos(
        antes,
        guardado as unknown as Record<string, unknown>,
        CAMPOS_AUDITABLES,
      );
      if (cambios.length > 0) {
        await this.bitacoraService.registrarEdicion(
          ModuloBitacora.EMPLEADOS,
          guardado.id,
          autor,
          cambios,
        );
      }

      // La cuenta de acceso vinculada se registra con el correo, no con el
      // id de usuario: "se vinculó ana@x.com" le dice algo a quien lee la
      // bitácora; "usuario_id: 7" no.
      const correoCuentaDespues = guardado.usuario?.email ?? null;
      if (correoCuentaAntes !== correoCuentaDespues) {
        await this.bitacoraService.registrar({
          modulo: ModuloBitacora.EMPLEADOS,
          registro_id: guardado.id,
          accion: AccionBitacora.EDICION,
          autor,
          campo: 'cuenta_acceso',
          valor_anterior: correoCuentaAntes,
          valor_nuevo: correoCuentaDespues,
          observaciones: correoCuentaDespues
            ? 'Cuenta de acceso vinculada'
            : 'Cuenta de acceso desvinculada',
        });
      }
    }

    return this.aPlano(guardado);
  }

  async cambiarEstado(
    id: number,
    estado: 'Activo' | 'Inactivo',
    autorId?: number,
  ): Promise<EmpleadoPlano> {
    const empleado = await this.empleadoRepository.findOne({
      where: { id },
      relations: { usuario: true },
    });
    if (!empleado) {
      throw new NotFoundException(`No se encontró el empleado con id ${id}`);
    }

    const estadoAnterior = empleado.estado;
    empleado.estado = estado;
    const guardado = await this.empleadoRepository.save(empleado);

    // Solo se registra si el estado realmente cambió: marcar "Activo" a un
    // empleado que ya estaba activo no es un movimiento.
    const autor = await this.autorDe(autorId);
    if (autor && estadoAnterior !== estado) {
      await this.bitacoraService.registrarCambioEstado(
        ModuloBitacora.EMPLEADOS,
        guardado.id,
        autor,
        estadoAnterior,
        estado,
        `Empleado ${guardado.nombre}`,
      );
    }

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
  async vincularCuenta(
    id: number,
    autorId?: number,
  ): Promise<{
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

    const rol = this.rolParaPuesto(empleado.puesto);
    await this.authService.crearCuentaParaEmpleado(empleado, rol);

    const actualizado = await this.obtenerPorId(id);

    // Se registra también el ROL con el que quedó la cuenta: es la parte
    // sensible de esta operación, porque define qué puede hacer esa persona
    // en el sistema.
    const autor = await this.autorDe(autorId);
    if (autor) {
      await this.bitacoraService.registrar({
        modulo: ModuloBitacora.EMPLEADOS,
        registro_id: id,
        accion: AccionBitacora.EDICION,
        autor,
        campo: 'cuenta_acceso',
        valor_anterior: null,
        valor_nuevo: correo,
        observaciones: `Cuenta de acceso vinculada con rol ${rol}`,
      });
    }

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