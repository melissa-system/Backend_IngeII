import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Averia } from './entities/averia.entity';
import { HistorialAveria } from './entities/historial-averia.entity';
import { CreateAveriaDto } from './dto/create-averia.dto';
import { UpdateAveriaDto } from './dto/update-averia.dto';
import { Empleado } from '../empleados/entities/empleado.entity';

@Injectable()
export class AveriasService {
  constructor(
    @InjectRepository(Averia)
    private readonly averiaRepository: Repository<Averia>,
    @InjectRepository(HistorialAveria)
    private readonly historialRepository: Repository<HistorialAveria>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
  ) {}

  async create(dto: CreateAveriaDto): Promise<Averia> {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const codigoGenerado = `AVE-2026-${randomNum}`;
    const nuevaAveria = this.averiaRepository.create({
      codigo_averia: codigoGenerado,
      tipo_averia: dto.tipo_averia,
      descripcion: dto.descripcion,
      cedula_reportante: dto.cedula_reportante,
      nombre_reportante: dto.nombre_reportante,
      apellido1_reportante: dto.apellido1_reportante,
      apellido2_reportante: dto.apellido2_reportante,
      estado: 'Pendiente',
    });

    const guardada = await this.averiaRepository.save(nuevaAveria);

    const primerHistorial = this.historialRepository.create({
      averia_id: guardada.id,
      estado_anterior: null,
      estado_nuevo: 'Pendiente',
      realizado_por: dto.nombre_reportante,
      observacion: 'Reporte creado por el abonado.',
    });
    await this.historialRepository.save(primerHistorial);

    return this.findOne(guardada.id);
  }

  async findAll(): Promise<Averia[]> {
    return await this.averiaRepository.find({
      relations: { empleado: true, historial: true },
      order: { fecha_reporte: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Averia> {
    const averia = await this.averiaRepository.findOne({
      where: { id },
      relations: { empleado: true, historial: true },
    });
    if (!averia) {
      throw new NotFoundException(
        `La avería con el ID ${id} no fue encontrada`,
      );
    }
    return averia;
  }

  async actualizar(id: number, dto: UpdateAveriaDto): Promise<Averia> {
    const averia = await this.findOne(id);

    if (dto.empleado_id) {
      const empleado = await this.empleadoRepository.findOneBy({
        id: dto.empleado_id,
      });
      if (!empleado) {
        throw new BadRequestException(
          `No se encontró un empleado con el ID ${dto.empleado_id}`,
        );
      }
      averia.empleado = empleado;

      const nombreEmp = `${empleado.nombre} ${empleado.apellido1 || ''}`.trim();
      const obsAsignacion = dto.observacion
        ? `Asignado a ${nombreEmp}. ${dto.observacion}`
        : `Asignado a ${nombreEmp}.`;

      const historialAsignacion = this.historialRepository.create({
        averia_id: id,
        estado_anterior: averia.estado,
        estado_nuevo: averia.estado,
        realizado_por: dto.realizado_por || 'Sistema',
        observacion: obsAsignacion,
      });
      await this.historialRepository.save(historialAsignacion);
    }

    if (dto.estado) {
      const estadosValidos = ['Pendiente', 'En proceso', 'Finalizado'];
      if (!estadosValidos.includes(dto.estado)) {
        throw new BadRequestException(
          `Estado inválido. Valores permitidos: ${estadosValidos.join(', ')}`,
        );
      }

      const cambioHistorial = this.historialRepository.create({
        averia_id: id,
        estado_anterior: averia.estado,
        estado_nuevo: dto.estado,
        realizado_por: dto.realizado_por || 'Sistema',
        observacion: dto.observacion || `Estado cambiado: ${averia.estado} → ${dto.estado}`,
      });
      await this.historialRepository.save(cambioHistorial);

      averia.estado = dto.estado;
    }

    await this.averiaRepository.save(averia);
    return this.findOne(id);
  }
}
