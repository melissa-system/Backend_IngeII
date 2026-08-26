import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Abonado } from './entities/abonado.entity';
import { HistorialAbonado } from './entities/historial-abonado.entity';
import { CreateAbonadoDto } from './dto/create-abonado.dto';
import { UpdateAbonadoDto } from './dto/update-abonado.dto';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class AbonadosService {
  constructor(
    @InjectRepository(Abonado)
    private readonly abonadoRepository: Repository<Abonado>,
    @InjectRepository(HistorialAbonado)
    private readonly historialRepository: Repository<HistorialAbonado>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

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

  // Reglas de negocio compartidas entre creación y actualización:
  // campos obligatorios, representante legal para jurídicas y
  // formato básico del correo.
  private validarDatosAbonado(datos: {
    tipo_abonado: string;
    nombre_completo?: string | null;
    cedula?: string | null;
    nombre_representante_legal?: string | null;
    telefono?: string | null;
    correo?: string | null;
    direccion?: string | null;
  }): void {
    // Antes de validar se uniforma el formato: si el usuario no escribió
    // los guiones del teléfono o la cédula, se agregan automáticamente.
    datos.telefono = this.formatearTelefono(datos.telefono);
    datos.cedula = this.formatearCedula(datos.cedula);

    const camposObligatorios = [
      'nombre_completo',
      'cedula',
      'telefono',
      'correo',
      'direccion',
    ] as const;
    for (const campo of camposObligatorios) {
      const valor = datos[campo];
      if (!valor || String(valor).trim() === '') {
        throw new BadRequestException(
          `El campo '${campo}' es obligatorio`,
        );
      }
    }

    if (
      datos.tipo_abonado === 'Jurídica' &&
      (!datos.nombre_representante_legal ||
        datos.nombre_representante_legal.trim() === '')
    ) {
      throw new BadRequestException(
        `El campo 'nombre_representante_legal' es obligatorio para personas jurídicas`,
      );
    }

    if (!String(datos.correo).includes('@')) {
      throw new BadRequestException('El correo electrónico no tiene un formato válido');
    }
  }

  async create(createAbonadoDto: CreateAbonadoDto): Promise<Abonado> {
    // 1. Validar que el tipo de abonado sea uno de los permitidos
    const tiposPermitidos = ['Física', 'Jurídica'];
    if (!tiposPermitidos.includes(createAbonadoDto.tipo_abonado)) {
      throw new BadRequestException(
        `El tipo de abonado debe ser 'Física' o 'Jurídica'`,
      );
    }

    // 2-4. Validar campos obligatorios, representante legal (jurídicas) y correo
    this.validarDatosAbonado(createAbonadoDto);

    // 5. Evitar abonados duplicados por número de cédula, correo o teléfono.
    // (createAbonadoDto.telefono ya llega formateado XXXX-XXXX gracias a
    // validarDatosAbonado, así que la comparación es consistente con lo
    // que queda guardado en la BD).
    const cedulaExistente = await this.abonadoRepository.findOneBy({
      cedula: createAbonadoDto.cedula,
    });
    if (cedulaExistente) {
      throw new BadRequestException(
        `Ya existe un abonado registrado con la cédula ${createAbonadoDto.cedula}`,
      );
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

    // 7. Crear el registro con estado "Activo" por defecto
    const nuevoAbonado = this.abonadoRepository.create({
      numero_abonado: numeroAbonado,
      tipo_abonado: createAbonadoDto.tipo_abonado,
      nombre_completo: createAbonadoDto.nombre_completo,
      nombre_representante_legal:
        createAbonadoDto.nombre_representante_legal || undefined,
      cedula: createAbonadoDto.cedula,
      telefono: createAbonadoDto.telefono,
      correo: createAbonadoDto.correo,
      direccion: createAbonadoDto.direccion,
      numero_plano_catastrado:
        createAbonadoDto.numero_plano_catastrado || undefined,
      estado: 'Activo',
    });

    // 8. Guardar en MySQL
    return await this.abonadoRepository.save(nuevoAbonado);
  }

  // Lista todos los abonados o filtra en SQL cuando llega ?buscar=<texto>.
  async findAll(buscar?: string): Promise<Abonado[]> {
    const texto = buscar?.trim();
    if (!texto) {
      return await this.abonadoRepository.find();
    }

    const patron = `%${texto}%`;
    return await this.abonadoRepository.find({
      where: [
        { nombre_completo: Like(patron) },
        { cedula: Like(patron) },
        { numero_abonado: Like(patron) },
        { telefono: Like(patron) },
        { direccion: Like(patron) },
      ],
    });
  }

  async findOne(id: number): Promise<Abonado> {
    const abonado = await this.abonadoRepository.findOneBy({ id });
    if (!abonado) {
      throw new NotFoundException(
        `El abonado con el ID ${id} no fue encontrado`,
      );
    }
    return abonado;
  }

  // Actualización parcial de los datos de contacto del abonado.
  // El tipo de abonado, la cédula, el estado y el número de abonado
  // NO son editables por esta vía (el estado tiene su propia ruta).
  async update(
    id: number,
    updateAbonadoDto: UpdateAbonadoDto,
    usuarioId?: number,
  ): Promise<Abonado> {
    const abonado = await this.findOne(id);

    const original: Record<string, string | null> = {
      nombre_completo: abonado.nombre_completo,
      nombre_representante_legal: abonado.nombre_representante_legal,
      telefono: abonado.telefono,
      correo: abonado.correo,
      direccion: abonado.direccion,
      numero_plano_catastrado: abonado.numero_plano_catastrado,
    };

    // Solo se aplican los campos enviados. Un string vacío en un campo
    // opcional limpia el valor (queda NULL), igual que al crear.
    const cambios: Record<string, string | null> = {};
    const camposTexto = [
      'nombre_completo',
      'nombre_representante_legal',
      'telefono',
      'correo',
      'direccion',
      'numero_plano_catastrado',
    ];
    for (const campo of camposTexto) {
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

    Object.assign(abonado, cambios);

    // Revalida las reglas sobre la entidad ya fusionada, según su tipo real
    this.validarDatosAbonado(abonado);

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

    const guardado = await this.abonadoRepository.save(abonado);

    if (usuarioId !== undefined) {
      await this.registrarHistorial(guardado.id, original, cambios, usuarioId);
    }

    return guardado;
  }

  // Cambio de estado operativo del abonado (Activo <-> Inactivo) desde
  // su ruta específica PATCH /abonados/:id/estado. Si el abonado ya
  // tiene ese estado no se reescribe ni se genera entrada de historial.
  async cambiarEstado(
    id: number,
    nuevoEstado: string,
    usuarioId?: number,
  ): Promise<Abonado> {
    const abonado = await this.findOne(id);
    const estadoAnterior = abonado.estado;

    if (estadoAnterior === nuevoEstado) {
      return abonado;
    }

    abonado.estado = nuevoEstado;
    const guardado = await this.abonadoRepository.save(abonado);

    if (usuarioId !== undefined) {
      await this.registrarHistorial(
        guardado.id,
        { estado: estadoAnterior },
        { estado: nuevoEstado },
        usuarioId,
      );
    }

    return guardado;
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
