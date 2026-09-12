import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Averia } from './entities/averia.entity';

@Injectable()
export class AveriasService {
  constructor(
    @InjectRepository(Averia)
    private readonly averiaRepository: Repository<Averia>,
  ) {}

  async create(datosAveria: any): Promise<Averia> {
    // 1. Generar código automático único
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const codigoGenerado = `AVE-2026-${randomNum}`;

    // 2. Mapear tipo_averia al ENUM de MySQL
    let tipoValido = datosAveria.tipo_averia;
    const tiposPermitidos = [
      'Fuga de agua',
      'Tubería rota',
      'Falta de presión / sin agua',
      'Contador dañado',
      'Fuga en la vía pública',
      'Otro',
      'Fuga',
      'Medidor dañado',
    ];

    if (!tiposPermitidos.includes(tipoValido || '')) {
      if (tipoValido?.includes('vía pública') || tipoValido?.includes('calle')) {
        tipoValido = 'Fuga en la vía pública';
      } else if (tipoValido?.includes('Fuga')) {
        tipoValido = 'Fuga de agua';
      } else if (tipoValido?.includes('Tubería')) {
        tipoValido = 'Tubería rota';
      } else if (tipoValido?.includes('presión') || tipoValido?.includes('agua')) {
        tipoValido = 'Falta de presión / sin agua';
      } else if (tipoValido?.includes('Contador') || tipoValido?.includes('Medidor')) {
        tipoValido = 'Contador dañado';
      } else {
        tipoValido = 'Otro';
      }
    }

    // 3. Extraer o asignar cédula y nombre (dividido) para los campos
    // requeridos en la BD
    const cedula = datosAveria.cedula_reportante || '504420101';
    const nombre = datosAveria.nombre_reportante || 'OSCAR ANDRES';
    const apellido1 = datosAveria.apellido1_reportante || 'AIZA';
    const apellido2 = datosAveria.apellido2_reportante || 'ZUÑIGA';

    // 4. Crear la entidad con todos los campos obligatorios completos
    const nuevaAveria = this.averiaRepository.create({
      codigo_averia: datosAveria.codigo_averia || codigoGenerado,
      tipo_averia: tipoValido,
      descripcion: datosAveria.descripcion || 'Sin descripción detallada',
      cedula_reportante: cedula,
      nombre_reportante: nombre,
      apellido1_reportante: apellido1,
      apellido2_reportante: apellido2 || undefined,
      estado: 'Pendiente',
    });

    // 5. Guardar en MySQL
    return await this.averiaRepository.save(nuevaAveria);
  }

  async findAll(): Promise<Averia[]> {
    return await this.averiaRepository.find();
  }

  async findOne(id: number): Promise<Averia> {
    const averia = await this.averiaRepository.findOneBy({ id });
    if (!averia) {
      throw new NotFoundException(
        `La avería con el ID ${id} no fue encontrada`,
      );
    }
    return averia;
  }
}
