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

    // 5. Evitar abonados duplicados por número de cédula
    const abonadoExistente = await this.abonadoRepository.findOneBy({
      cedula: createAbonadoDto.cedula,
    });
    if (abonadoExistente) {
      throw new BadRequestException(
        `Ya existe un abonado registrado con la cédula ${createAbonadoDto.cedula}`,
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
  // NO son editables por esta vía.
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

    Object.assign(abonado, cambios);

    // Revalida las reglas sobre la entidad ya fusionada, según su tipo real
    this.validarDatosAbonado(abonado);

    const guardado = await this.abonadoRepository.save(abonado);

    if (usuarioId !== undefined) {
      await this.registrarHistorial(guardado.id, original, cambios, usuarioId);
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
