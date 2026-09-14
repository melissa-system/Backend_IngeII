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
import { BitacoraService } from '../bitacora/bitacora.service';
import { ModuloBitacora, AccionBitacora } from '../bitacora/entities/bitacora.enums';

@Injectable()
export class AveriasService {
  constructor(
    @InjectRepository(Averia)
    private readonly averiaRepository: Repository<Averia>,
    @InjectRepository(HistorialAveria)
    private readonly historialRepository: Repository<HistorialAveria>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    private readonly bitacoraService: BitacoraService,
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

    // El reporte lo crea el abonado desde el formulario público, sin sesión
    // autenticada: por eso el autor va con id null y el nombre que escribió
    // en el formulario como referencia.
    await this.bitacoraService.registrarCreacion(
      ModuloBitacora.AVERIAS,
      guardada.id,
      { id: null, email: dto.nombre_reportante },
      'Reporte creado por el abonado.',
    );
    return this.findOne(guardada.id);
  }

  async findAll(): Promise<Averia[]> {
    const averias = await this.averiaRepository.find({
      relations: { empleado: true },
      order: { fecha_reporte: 'DESC' },
    });
 
    // El historial ya no es una relación de TypeORM: se arma desde la
    // bitácora, pero se adjunta con el mismo nombre para que el frontend
    // no cambie.
    for (const averia of averias) {
      (averia as unknown as Record<string, unknown>).historial =
        await this.armarHistorial(averia.id);
    }
 
    return averias;
  }

  async findOne(id: number): Promise<Averia> {
    const averia = await this.averiaRepository.findOne({
      where: { id },
      relations: { empleado: true },
    });
    if (!averia) {
      throw new NotFoundException(
        `La avería con el ID ${id} no fue encontrada`,
      );
    }
 
    (averia as unknown as Record<string, unknown>).historial =
      await this.armarHistorial(averia.id);
 
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

      // Asignar fontanero no cambia el estado de la avería, así que se
      // registra como EDICION del campo 'empleado', no como cambio de estado.
      await this.bitacoraService.registrar({
        modulo: ModuloBitacora.AVERIAS,
        registro_id: id,
        accion: AccionBitacora.EDICION,
        autor: { id: null, email: dto.realizado_por || 'Sistema' },
        campo: 'empleado',
        valor_anterior: null,
        valor_nuevo: nombreEmp,
        observaciones: obsAsignacion,
      });
    }

    if (dto.estado) {
      const estadosValidos = ['Pendiente', 'En proceso', 'Finalizado'];
      if (!estadosValidos.includes(dto.estado)) {
        throw new BadRequestException(
          `Estado inválido. Valores permitidos: ${estadosValidos.join(', ')}`,
        );
      }

      await this.bitacoraService.registrarCambioEstado(
        ModuloBitacora.AVERIAS,
        id,
        { id: null, email: dto.realizado_por || 'Sistema' },
        averia.estado,
        dto.estado,
        dto.observacion ||
          `Estado cambiado: ${averia.estado} → ${dto.estado}`,
      );
      averia.estado = dto.estado;
    }

    await this.averiaRepository.save(averia);
    return this.findOne(id);
  }

  // Arma el historial de una avería con la MISMA forma que devolvía la
  // relación de TypeORM (estado_anterior / estado_nuevo / realizado_por /
  // observacion / fecha), pero leyendo de la bitácora general y
  // concatenando lo que quedó en la tabla vieja. Así el frontend sigue
  // recibiendo `averia.historial` exactamente igual que antes.
  private async armarHistorial(averiaId: number) {
    const nuevos = await this.bitacoraService.historialDeRegistro(
      ModuloBitacora.AVERIAS,
      averiaId,
    );
 
    const viejos = await this.historialRepository.find({
      where: { averia_id: averiaId },
      order: { fecha: 'DESC' },
    });
 
    return [
      ...nuevos.map((b) => ({
        id: b.id,
        averia_id: averiaId,
        estado_anterior: b.valor_anterior,
        estado_nuevo: b.valor_nuevo ?? '',
        realizado_por: b.usuario_email ?? 'Sistema',
        observacion: b.observaciones,
        fecha: b.fecha,
      })),
      ...viejos.map((h) => ({
        id: h.id,
        averia_id: h.averia_id,
        estado_anterior: h.estado_anterior,
        estado_nuevo: h.estado_nuevo,
        realizado_por: h.realizado_por,
        observacion: h.observacion,
        fecha: h.fecha,
      })),
    ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }
}
