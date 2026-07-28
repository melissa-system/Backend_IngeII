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
    const tiposPermitidos = ['Fuga', 'Tubería rota', 'Medidor dañado', 'Otro'];

    if (!tiposPermitidos.includes(tipoValido || '')) {
      if (tipoValido?.includes('Fuga')) {
        tipoValido = 'Fuga';
      } else if (tipoValido?.includes('Tubería')) {
        tipoValido = 'Tubería rota';
      } else {
        tipoValido = 'Otro';
      }
    }

    // 3. Extraer o asignar cédula y nombre para los campos requeridos en la BD
    const cedula = datosAveria.cedula_reportante || '504420101';
    const nombre = datosAveria.nombre_reportante || 'OSCAR ANDRES AIZA ZUÑIGA';

    // 4. Crear la entidad con todos los campos obligatorios completos
    const nuevaAveria = this.averiaRepository.create({
      codigo_averia: datosAveria.codigo_averia || codigoGenerado,
      tipo_averia: tipoValido,
      descripcion: datosAveria.descripcion || 'Sin descripción detallada',
      cedula_reportante: cedula,
      nombre_reportante: nombre,
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
      throw new NotFoundException(`La avería con el ID ${id} no fue encontrada`);
    }
    return averia;
  }
}