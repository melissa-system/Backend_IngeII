import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Abonado } from './entities/abonado.entity';
import { CreateAbonadoDto } from './dto/create-abonado.dto';

@Injectable()
export class AbonadosService {
  constructor(
    @InjectRepository(Abonado)
    private readonly abonadoRepository: Repository<Abonado>,
  ) {}

  async create(createAbonadoDto: CreateAbonadoDto): Promise<Abonado> {
    // 1. Validar que el tipo de abonado sea uno de los permitidos
    const tiposPermitidos = ['Física', 'Jurídica'];
    if (!tiposPermitidos.includes(createAbonadoDto.tipo_abonado)) {
      throw new BadRequestException(
        `El tipo de abonado debe ser 'Física' o 'Jurídica'`,
      );
    }

    // 2. Validar campos obligatorios comunes a ambos tipos
    const camposObligatorios = [
      'nombre_completo',
      'cedula',
      'telefono',
      'correo',
      'direccion',
    ];
    for (const campo of camposObligatorios) {
      const valor = (createAbonadoDto as any)[campo];
      if (!valor || String(valor).trim() === '') {
        throw new BadRequestException(
          `El campo '${campo}' es obligatorio`,
        );
      }
    }

    // 3. Validar campo adicional obligatorio solo para persona jurídica
    if (
      createAbonadoDto.tipo_abonado === 'Jurídica' &&
      (!createAbonadoDto.nombre_representante_legal ||
        createAbonadoDto.nombre_representante_legal.trim() === '')
    ) {
      throw new BadRequestException(
        `El campo 'nombre_representante_legal' es obligatorio para personas jurídicas`,
      );
    }

    // 4. Validar formato básico del correo electrónico
    if (!createAbonadoDto.correo.includes('@')) {
      throw new BadRequestException('El correo electrónico no tiene un formato válido');
    }

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

  async findAll(): Promise<Abonado[]> {
    return await this.abonadoRepository.find();
  }
}
