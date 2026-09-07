import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Abonado } from './entities/abonado.entity';
import { HistorialAbonado } from './entities/historial-abonado.entity';
import { CreateAbonadoDto } from './dto/create-abonado.dto';
import { UpdateAbonadoDto } from './dto/update-abonado.dto';
import { User } from '../auth/entities/user.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { AuthService } from '../auth/auth.service';

// Forma "plana" que consume el frontend: junta la fila base con los campos
// de la subtabla que corresponda (fisico o juridico) en un solo objeto,
// igual que antes de normalizar la tabla en abonados/abonados_fisicos/
// abonados_juridicos. Así el resto del sistema no tiene que saber que por
// dentro son 3 tablas.
export interface AbonadoPlano {
  id: number;
  numero_abonado: string;
  tipo_abonado: string;
  nombre: string;
  cedula: string;
  telefono: string;
  correo: string;
  direccion: string;
  estado: string;
  fecha_registro: Date;
  usuario_id: number | null;
  // Solo física
  apellido1: string | null;
  apellido2: string | null;
  numero_plano_catastrado: string | null;
  // Solo jurídica
  nombre_representante_legal: string | null;
  cedula_representante: string | null;
}

const RELACIONES_DETALLE = { fisico: true, juridico: true, usuario: true } as const;

@Injectable()
export class AbonadosService {
  constructor(
    @InjectRepository(Abonado)
    private readonly abonadoRepository: Repository<Abonado>,
    @InjectRepository(HistorialAbonado)
    private readonly historialRepository: Repository<HistorialAbonado>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    private readonly authService: AuthService,
  ) {}

  private aPlano(abonado: Abonado): AbonadoPlano {
    return {
      id: abonado.id,
      numero_abonado: abonado.numero_abonado,
      tipo_abonado: abonado.tipo_abonado,
      nombre: abonado.nombre,
      cedula: abonado.cedula,
      telefono: abonado.telefono,
      correo: abonado.correo,
      direccion: abonado.direccion,
      estado: abonado.estado,
      fecha_registro: abonado.fecha_registro,
      usuario_id: abonado.usuario?.id ?? null,
      apellido1: abonado.fisico?.apellido1 ?? null,
      apellido2: abonado.fisico?.apellido2 ?? null,
      numero_plano_catastrado: abonado.fisico?.numero_plano_catastrado ?? null,
      nombre_representante_legal:
        abonado.juridico?.nombre_representante_legal ?? null,
      cedula_representante: abonado.juridico?.cedula_representante ?? null,
    };
  }

  // Uniforma teléfonos de 8 dígitos al formato XXXX-XXXX. Cualquier otro
  // formato (internacionales, extensiones, etc.) se respeta tal cual.
  private formatearTelefono(telefono?: string | null): string | null {
    if (!telefono) return telefono ?? null;
    const digitos = telefono.replace(/\D/g, '');
    if (digitos.length === 8) {
      return `${digitos.slice(0, 4)}-${digitos.slice(4)}`;
    }
    return String(telefono).trim();
  }

  // Uniforma cédulas costarricenses: física (9 dígitos) como X-XXXX-XXXX
  // y jurídica (10 dígitos) como X-XXX-XXXXXX. Otros documentos (DIMEX,
  // pasaportes, etc.) se dejan tal cual.
  private formatearCedula(cedula?: string | null): string | null {
    if (!cedula) return cedula ?? null;
    const digitos = cedula.replace(/\D/g, '');
    if (digitos.length === 9) {
      return `${digitos.slice(0, 1)}-${digitos.slice(1, 5)}-${digitos.slice(5)}`;
    }
    if (digitos.length === 10) {
      return `${digitos.slice(0, 1)}-${digitos.slice(1, 4)}-${digitos.slice(4)}`;
    }
    return String(cedula).trim();
  }

  // Reglas de negocio compartidas entre creación y actualización: campos
  // obligatorios de la tabla base, y los exclusivos de cada subtabla según
  // tipo_abonado (representante legal + su cédula para jurídica).
  private validarDatosAbonado(datos: {
    tipo_abonado: string;
    nombre?: string | null;
    cedula?: string | null;
    telefono?: string | null;
    correo?: string | null;
    direccion?: string | null;
    apellido1?: string | null;
    nombre_representante_legal?: string | null;
    cedula_representante?: string | null;
  }): void {
    // Antes de validar se uniforma el formato: si el usuario no escribió
    // los guiones del teléfono o la cédula, se agregan automáticamente.
    datos.telefono = this.formatearTelefono(datos.telefono);
    datos.cedula = this.formatearCedula(datos.cedula);

    const camposObligatorios = [
      'nombre',
      'cedula',
      'telefono',
      'correo',
      'direccion',
    ] as const;
    for (const campo of camposObligatorios) {
      const valor = datos[campo];
      if (!valor || String(valor).trim() === '') {
        throw new BadRequestException(`El campo '${campo}' es obligatorio`);
      }
    }

    if (datos.tipo_abonado === 'Jurídica') {
      if (
        !datos.nombre_representante_legal ||
        datos.nombre_representante_legal.trim() === ''
      ) {
        throw new BadRequestException(
          `El campo 'nombre_representante_legal' es obligatorio para personas jurídicas`,
        );
      }
      if (
        !datos.cedula_representante ||
        datos.cedula_representante.trim() === ''
      ) {
        throw new BadRequestException(
          `El campo 'cedula_representante' es obligatorio para personas jurídicas`,
        );
      }
    }

    if (!String(datos.correo).includes('@')) {
      throw new BadRequestException('El correo electrónico no tiene un formato válido');
    }
  }

  async create(createAbonadoDto: CreateAbonadoDto): Promise<AbonadoPlano> {
    // 1. Validar que el tipo de abonado sea uno de los permitidos
    const tiposPermitidos = ['Física', 'Jurídica'];
    if (!tiposPermitidos.includes(createAbonadoDto.tipo_abonado)) {
      throw new BadRequestException(
        `El tipo de abonado debe ser 'Física' o 'Jurídica'`,
      );
    }

    // 2-4. Validar campos obligatorios de la base y de la subtabla que aplique
    this.validarDatosAbonado(createAbonadoDto);

    // 5. Evitar abonados duplicados por número de cédula, correo o teléfono.
    const cedulaExistente = await this.abonadoRepository.findOneBy({
      cedula: createAbonadoDto.cedula,
    });
    if (cedulaExistente) {
      throw new BadRequestException(
        `Ya existe un abonado registrado con la cédula ${createAbonadoDto.cedula}`,
      );
    }

    // 5b. La cédula tampoco puede repetirse con la de un empleado, SALVO que
    // se confirme explícitamente que es la misma persona (ej. alguien de la
    // Junta que también es abonado): sin confirmarVinculacion se rechaza
    // (evita duplicados por error), con él se permite. Ver mismo criterio
    // simétrico en EmpleadosService.
    const empleadoConEsaCedula = await this.empleadoRepository.findOneBy({
      cedula: createAbonadoDto.cedula,
    });
    if (empleadoConEsaCedula && !createAbonadoDto.confirmarVinculacion) {
      throw new BadRequestException({
        requiereConfirmacion: true,
        tipo: 'empleado',
        registro: {
          id: empleadoConEsaCedula.id,
          nombre: empleadoConEsaCedula.nombre,
        },
        message: `La cédula ${createAbonadoDto.cedula} ya está registrada como empleado (${empleadoConEsaCedula.nombre}). Si es la misma persona, confirmá para registrarla también como abonado.`,
      });
    }

    const correoExistente = await this.abonadoRepository.findOneBy({
      correo: createAbonadoDto.correo,
    });
    if (correoExistente) {
      throw new BadRequestException(
        `Ya existe un abonado registrado con el correo ${createAbonadoDto.correo}`,
      );
    }

    const telefonoExistente = await this.abonadoRepository.findOneBy({
      telefono: createAbonadoDto.telefono,
    });
    if (telefonoExistente) {
      throw new BadRequestException(
        `Ya existe un abonado registrado con el teléfono ${createAbonadoDto.telefono}`,
      );
    }

    // 6. Generar número de abonado único (Ej: AB-2026-0001)
    const anioActual = new Date().getFullYear();
    const totalAbonados = await this.abonadoRepository.count();
    const numeroAbonado = `AB-${anioActual}-${String(totalAbonados + 1).padStart(4, '0')}`;

    // 7. Armar la fila base + la fila de la subtabla que corresponda.
    // Gracias a cascade:true en Abonado.fisico/Abonado.juridico, un solo
    // .save() inserta ambas filas en una sola operación transaccional (no
    // puede quedar un abonado sin su detalle a medio guardar).
    const nuevoAbonado = this.abonadoRepository.create({
      numero_abonado: numeroAbonado,
      tipo_abonado: createAbonadoDto.tipo_abonado,
      nombre: createAbonadoDto.nombre,
      cedula: createAbonadoDto.cedula,
      telefono: createAbonadoDto.telefono,
      correo: createAbonadoDto.correo,
      direccion: createAbonadoDto.direccion,
      estado: 'Activo',
      fisico:
        createAbonadoDto.tipo_abonado === 'Física'
          ? {
              apellido1: createAbonadoDto.apellido1 ?? null,
              apellido2: createAbonadoDto.apellido2 || null,
              numero_plano_catastrado:
                createAbonadoDto.numero_plano_catastrado || null,
            }
          : null,
      juridico:
        createAbonadoDto.tipo_abonado === 'Jurídica'
          ? {
              nombre_representante_legal:
                createAbonadoDto.nombre_representante_legal ?? null,
              cedula_representante:
                createAbonadoDto.cedula_representante ?? null,
            }
          : null,
    });

    const guardado = await this.abonadoRepository.save(nuevoAbonado);

    // 8. Crear (o vincular) automáticamente la cuenta de acceso del
    // abonado y mandarle el correo para que defina su contraseña — ver
    // AuthService.crearCuentaParaAbonado(). Se aísla en su propio
    // try/catch: el abonado ya quedó guardado, así que un problema acá
    // (rol faltante, SMTP caído, etc.) no debe tumbar el alta. El acceso
    // se puede resolver después a mano desde el módulo de Usuarios.
    try {
      await this.authService.crearCuentaParaAbonado(guardado);
    } catch (error) {
      console.error(
        `No se pudo crear la cuenta de acceso para el abonado ${guardado.id}:`,
        error,
      );
    }

    return this.aPlano(await this.cargarConDetalle(guardado.id));
  }

  private async cargarConDetalle(id: number): Promise<Abonado> {
    const abonado = await this.abonadoRepository.findOne({
      where: { id },
      relations: RELACIONES_DETALLE,
    });
    if (!abonado) {
      throw new NotFoundException(`El abonado con el ID ${id} no fue encontrado`);
    }
    return abonado;
  }

  // Lista todos los abonados o filtra en SQL cuando llega ?buscar=<texto>.
  // La búsqueda incluye apellido1/apellido2 (viven en abonados_fisicos)
  // además de los campos de la tabla base.
  async findAll(buscar?: string): Promise<AbonadoPlano[]> {
    const query = this.abonadoRepository
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.fisico', 'fisico')
      .leftJoinAndSelect('a.juridico', 'juridico')
      .leftJoinAndSelect('a.usuario', 'usuario');

    const texto = buscar?.trim();
    if (texto) {
      const patron = `%${texto}%`;
      query.andWhere(
        `(a.nombre LIKE :patron
          OR a.cedula LIKE :patron
          OR a.numero_abonado LIKE :patron
          OR a.telefono LIKE :patron
          OR a.direccion LIKE :patron
          OR fisico.apellido1 LIKE :patron
          OR fisico.apellido2 LIKE :patron)`,
        { patron },
      );
    }

    const abonados = await query.getMany();
    return abonados.map((a) => this.aPlano(a));
  }

  async findOne(id: number): Promise<AbonadoPlano> {
    return this.aPlano(await this.cargarConDetalle(id));
  }

  // Actualización parcial de los datos de contacto del abonado.
  // El tipo de abonado, la cédula, el estado y el número de abonado
  // NO son editables por esta vía (el estado tiene su propia ruta).
  async update(
    id: number,
    updateAbonadoDto: UpdateAbonadoDto,
    usuarioId?: number,
  ): Promise<AbonadoPlano> {
    const abonado = await this.cargarConDetalle(id);

    const original: Record<string, string | null> = {
      nombre: abonado.nombre,
      telefono: abonado.telefono,
      correo: abonado.correo,
      direccion: abonado.direccion,
      apellido1: abonado.fisico?.apellido1 ?? null,
      apellido2: abonado.fisico?.apellido2 ?? null,
      numero_plano_catastrado: abonado.fisico?.numero_plano_catastrado ?? null,
      nombre_representante_legal:
        abonado.juridico?.nombre_representante_legal ?? null,
      cedula_representante: abonado.juridico?.cedula_representante ?? null,
    };

    // Solo se aplican los campos enviados. Un string vacío en un campo
    // opcional limpia el valor (queda NULL), igual que al crear.
    const cambios: Record<string, string | null> = {};
    const camposEditables = [
      'nombre',
      'telefono',
      'correo',
      'direccion',
      'apellido1',
      'apellido2',
      'numero_plano_catastrado',
      'nombre_representante_legal',
      'cedula_representante',
    ];
    for (const campo of camposEditables) {
      const valor = (updateAbonadoDto as Record<string, unknown>)[campo];
      if (valor === undefined) continue;
      const texto = String(valor).trim();
      cambios[campo] = texto === '' ? null : texto;
    }

    // El teléfono se uniforma aquí (y no solo en la entidad) para que el
    // historial compare el valor ya formateado contra el anterior.
    if (cambios['telefono'] != null) {
      cambios['telefono'] = this.formatearTelefono(cambios['telefono']);
    }

    const camposBase = ['nombre', 'telefono', 'correo', 'direccion'];
    for (const campo of camposBase) {
      if (cambios[campo] !== undefined) {
        (abonado as unknown as Record<string, string | null>)[campo] =
          cambios[campo];
      }
    }

    if (abonado.tipo_abonado === 'Física') {
      if (!abonado.fisico) {
        abonado.fisico = {
          apellido1: null,
          apellido2: null,
          numero_plano_catastrado: null,
        } as Abonado['fisico'];
      }
      const camposFisico = ['apellido1', 'apellido2', 'numero_plano_catastrado'];
      for (const campo of camposFisico) {
        if (cambios[campo] !== undefined) {
          (abonado.fisico as unknown as Record<string, string | null>)[campo] =
            cambios[campo];
        }
      }
    } else if (abonado.tipo_abonado === 'Jurídica') {
      if (!abonado.juridico) {
        abonado.juridico = {
          nombre_representante_legal: null,
          cedula_representante: null,
        } as Abonado['juridico'];
      }
      const camposJuridico = ['nombre_representante_legal', 'cedula_representante'];
      for (const campo of camposJuridico) {
        if (cambios[campo] !== undefined) {
          (abonado.juridico as unknown as Record<string, string | null>)[
            campo
          ] = cambios[campo];
        }
      }
    }

    // Revalida las reglas sobre la entidad ya fusionada, según su tipo real
    this.validarDatosAbonado({
      tipo_abonado: abonado.tipo_abonado,
      nombre: abonado.nombre,
      cedula: abonado.cedula,
      telefono: abonado.telefono,
      correo: abonado.correo,
      direccion: abonado.direccion,
      apellido1: abonado.fisico?.apellido1,
      nombre_representante_legal: abonado.juridico?.nombre_representante_legal,
      cedula_representante: abonado.juridico?.cedula_representante,
    });

    // Si el correo o el teléfono cambiaron, evitar que queden duplicados
    // con OTRO abonado (se excluye el propio registro de la búsqueda).
    if (cambios['correo'] !== undefined) {
      const otroConCorreo = await this.abonadoRepository.findOneBy({
        correo: abonado.correo,
      });
      if (otroConCorreo && otroConCorreo.id !== abonado.id) {
        throw new BadRequestException(
          `Ya existe un abonado registrado con el correo ${abonado.correo}`,
        );
      }
    }

    if (cambios['telefono'] !== undefined) {
      const otroConTelefono = await this.abonadoRepository.findOneBy({
        telefono: abonado.telefono,
      });
      if (otroConTelefono && otroConTelefono.id !== abonado.id) {
        throw new BadRequestException(
          `Ya existe un abonado registrado con el teléfono ${abonado.telefono}`,
        );
      }
    }

    // cascade:true guarda también la subtabla (fisico o juridico) que se
    // haya modificado, en la misma operación.
    const guardado = await this.abonadoRepository.save(abonado);

    if (usuarioId !== undefined) {
      await this.registrarHistorial(guardado.id, original, cambios, usuarioId);
    }

    return this.aPlano(await this.cargarConDetalle(guardado.id));
  }

  // Cambio de estado operativo del abonado (Activo <-> Inactivo) desde
  // su ruta específica PATCH /abonados/:id/estado. Si el abonado ya
  // tiene ese estado no se reescribe ni se genera entrada de historial.
  async cambiarEstado(
    id: number,
    nuevoEstado: string,
    usuarioId?: number,
  ): Promise<AbonadoPlano> {
    const abonado = await this.cargarConDetalle(id);
    const estadoAnterior = abonado.estado;

    if (estadoAnterior === nuevoEstado) {
      return this.aPlano(abonado);
    }

    abonado.estado = nuevoEstado;
    const guardado = await this.abonadoRepository.save(abonado);

    // Si se inhabilita el abonado y tiene una cuenta de usuario vinculada,
    // esa cuenta se desactiva también (y se le revocan las sesiones
    // activas — ver AuthService.cambiarEstadoUsuario): un abonado inactivo
    // no debería poder seguir entrando a consultar sus documentos o
    // servicios. Es una cascada de un solo sentido a propósito: reactivar
    // el abonado NO reactiva automáticamente su usuario, eso queda como
    // decisión aparte del administrador.
    if (nuevoEstado === 'Inactivo' && abonado.usuario) {
      await this.authService.cambiarEstadoUsuario(abonado.usuario.id, false);
    }

    if (usuarioId !== undefined) {
      await this.registrarHistorial(
        guardado.id,
        { estado: estadoAnterior },
        { estado: nuevoEstado },
        usuarioId,
      );
    }

    return this.aPlano(guardado);
  }

  // Guarda una fila por cada campo cuyo valor cambió realmente.
  private async registrarHistorial(
    abonadoId: number,
    original: Record<string, string | null>,
    cambios: Record<string, string | null>,
    usuarioId: number,
  ): Promise<void> {
    const pares = Object.keys(cambios)
      .map((campo) => ({
        campo,
        anterior: original[campo] ?? null,
        nuevo: cambios[campo] ?? null,
      }))
      .filter((p) => (p.anterior ?? '') !== (p.nuevo ?? ''));

    if (pares.length === 0) return;

    const usuario = await this.userRepository.findOneBy({ id: usuarioId });
    const email = usuario?.email ?? `usuario-${usuarioId}`;

    await this.historialRepository.save(
      pares.map((p) =>
        this.historialRepository.create({
          abonado: { id: abonadoId },
          usuario_email: email,
          campo: p.campo,
          valor_anterior: p.anterior,
          valor_nuevo: p.nuevo,
        }),
      ),
    );
  }

  async obtenerHistorial(id: number): Promise<HistorialAbonado[]> {
    const abonado = await this.findOne(id);
    return await this.historialRepository.find({
      where: { abonado: { id: abonado.id } },
      order: { fecha: 'DESC' },
    });
  }
}
