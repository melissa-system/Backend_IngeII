import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LaborAdicional } from './entities/labor-adicional.entity';
import { CrearLaborDto } from './dto/crear-labor.dto';
import { ActualizarLaborDto } from './dto/actualizar-labor.dto';
import { FiltrarLaboresDto } from './dto/filtrar-labores.dto';
import { Empleado } from '../empleados/entities/empleado.entity';
import { User } from '../auth/entities/user.entity';
import { BitacoraService } from '../bitacora/bitacora.service';
import {
  AccionBitacora,
  ModuloBitacora,
} from '../bitacora/entities/bitacora.enums';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { TipoActividad } from '../reportes-fontanero/entities/reporte-fontanero.enums';
import {
  aplicarInicioGestion,
  aplicarTerminoGestion,
  calcularDuracionMinutos,
} from '../../common/gestion-trabajo/gestion-trabajo';

@Injectable()
export class LaboresAdicionalesService {
  constructor(
    @InjectRepository(LaborAdicional)
    private readonly laborRepository: Repository<LaborAdicional>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly bitacoraService: BitacoraService,
  ) {}

  private async autorDe(usuarioId?: number) {
    if (!usuarioId) return { id: null, email: null };
    const usuario = await this.userRepository.findOneBy({ id: usuarioId });
    return { id: usuarioId, email: usuario?.email ?? null };
  }

  private generarCodigo(): string {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `LAB-2026-${random}`;
  }

  private async buscarEmpleado(id: number): Promise<Empleado> {
    const empleado = await this.empleadoRepository.findOneBy({ id });
    if (!empleado) {
      throw new NotFoundException(`No se encontró un empleado con el ID ${id}`);
    }
    return empleado;
  }

  async crear(dto: CrearLaborDto, usuarioId?: number): Promise<LaborAdicional> {
    const empleado = dto.empleadoId
      ? await this.buscarEmpleado(dto.empleadoId)
      : null;
    const autor = await this.autorDe(usuarioId);

    const labor = this.laborRepository.create({
      codigo_labor: this.generarCodigo(),
      tipo_actividad: dto.tipoActividad as TipoActividad,
      descripcion: dto.descripcion.trim(),
      estado: 'Pendiente',
      empleado,
    });
    const guardada = await this.laborRepository.save(labor);

    await this.bitacoraService.registrarCreacion(
      ModuloBitacora.LABORES_ADICIONALES,
      guardada.id,
      autor,
      `Se creó la labor ${guardada.codigo_labor}${
        empleado ? ` y se asignó a ${empleado.nombre}` : ''
      }.`,
    );

    return this.findOne(guardada.id);
  }

  // Crea una labor a partir de un reporte manual del fontanero (un reporte que
  // no está ligado a una avería ni a una labor ya asignada). Queda "En
  // revisión" para que la administración la revise desde el reporte y, al
  // aprobarla, aparezca como finalizada en "Otros mantenimientos".
  async crearDesdeReporte(datos: {
    tipoActividad: TipoActividad;
    descripcion: string;
    empleadoId: number;
    creadoPorId?: number;
  }): Promise<LaborAdicional> {
    const empleado = await this.buscarEmpleado(datos.empleadoId);
    const creadoPor = datos.creadoPorId
      ? await this.userRepository.findOneBy({ id: datos.creadoPorId })
      : null;

    const labor = this.laborRepository.create({
      codigo_labor: this.generarCodigo(),
      tipo_actividad: datos.tipoActividad,
      descripcion: datos.descripcion.trim(),
      estado: 'En revisión',
      empleado,
      creado_por: creadoPor,
    });
    const guardada = await this.laborRepository.save(labor);

    await this.bitacoraService.registrarCreacion(
      ModuloBitacora.LABORES_ADICIONALES,
      guardada.id,
      await this.autorDe(datos.creadoPorId),
      `Se registró la labor ${guardada.codigo_labor} desde un reporte del fontanero.`,
    );

    return this.findOne(guardada.id);
  }

  async findAll(filtros: FiltrarLaboresDto): Promise<LaborAdicional[]> {
    const where: Record<string, unknown> = {};
    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.tipoActividad) where.tipo_actividad = filtros.tipoActividad;
    if (filtros.empleadoId) where.empleado = { id: filtros.empleadoId };

    return this.laborRepository.find({
      where,
      relations: { empleado: true },
      order: { fecha_creacion: 'DESC', id: 'DESC' },
    });
  }

  async findOne(id: number): Promise<LaborAdicional> {
    const labor = await this.laborRepository.findOne({
      where: { id },
      relations: { empleado: true },
    });
    if (!labor) {
      throw new NotFoundException(`La labor con el ID ${id} no fue encontrada`);
    }
    return labor;
  }

  async actualizar(
    id: number,
    dto: ActualizarLaborDto,
    usuarioId?: number,
  ): Promise<LaborAdicional> {
    const labor = await this.findOne(id);
    const autor = await this.autorDe(usuarioId);

    if (dto.empleadoId) {
      const empleado = await this.buscarEmpleado(dto.empleadoId);
      labor.empleado = empleado;
      await this.bitacoraService.registrar({
        modulo: ModuloBitacora.LABORES_ADICIONALES,
        registro_id: id,
        accion: AccionBitacora.EDICION,
        autor,
        campo: 'empleado',
        valor_anterior: null,
        valor_nuevo: empleado.nombre,
        observaciones: dto.observacion ?? `Asignada a ${empleado.nombre}.`,
      });
    }

    if (dto.tipoActividad) {
      labor.tipo_actividad = dto.tipoActividad as TipoActividad;
    }
    if (dto.descripcion) {
      labor.descripcion = dto.descripcion.trim();
    }

    if (dto.estado && dto.estado !== labor.estado) {
      await this.bitacoraService.registrarCambioEstado(
        ModuloBitacora.LABORES_ADICIONALES,
        id,
        autor,
        labor.estado,
        dto.estado,
        dto.observacion || `Estado cambiado: ${labor.estado} → ${dto.estado}`,
      );
      labor.estado = dto.estado;
    }

    await this.laborRepository.save(labor);
    return this.findOne(id);
  }

  // Labores asignadas al fontanero autenticado que siguen abiertas.
  async misLabores(user: RequestUser): Promise<LaborAdicional[]> {
    const empleado = await this.empleadoRepository.findOne({
      where: { usuario: { id: user.id } },
    });
    if (!empleado) {
      throw new NotFoundException(
        'No se encontró un empleado vinculado a esta cuenta',
      );
    }

    const labores = await this.laborRepository.find({
      where: {
        empleado: { id: empleado.id },
        estado: In(['Pendiente', 'En proceso']),
      },
      relations: { empleado: true },
      order: { fecha_creacion: 'ASC', id: 'ASC' },
    });

    // Las devueltas por revisión van primero.
    return labores.sort(
      (a, b) => Number(b.devuelta_revision) - Number(a.devuelta_revision),
    );
  }

  // Resuelve el empleado del fontanero y valida que la labor sea suya.
  private async laborDelFontanero(
    id: number,
    user: RequestUser,
  ): Promise<LaborAdicional> {
    const empleado = await this.empleadoRepository.findOne({
      where: { usuario: { id: user.id } },
    });
    if (!empleado) {
      throw new NotFoundException(
        'No se encontró un empleado vinculado a esta cuenta',
      );
    }

    const labor = await this.findOne(id);
    if (labor.empleado?.id !== empleado.id) {
      throw new ForbiddenException('Esta labor no está asignada a tu cuenta.');
    }
    return labor;
  }

  async iniciarGestion(id: number, user: RequestUser): Promise<LaborAdicional> {
    const labor = await this.laborDelFontanero(id, user);

    if (labor.estado === 'Finalizado' || labor.estado === 'En revisión') {
      throw new BadRequestException(
        'Esta labor ya fue reportada o finalizada y no se puede volver a iniciar.',
      );
    }

    const estadoAnterior = labor.estado;
    aplicarInicioGestion(labor);

    if (estadoAnterior !== 'En proceso') {
      const autor = await this.autorDe(user.id);
      await this.bitacoraService.registrarCambioEstado(
        ModuloBitacora.LABORES_ADICIONALES,
        id,
        autor,
        estadoAnterior,
        'En proceso',
        'El fontanero inició la gestión de la labor.',
      );
    }

    await this.laborRepository.save(labor);
    return this.findOne(id);
  }

  async terminarGestion(
    id: number,
    user: RequestUser,
  ): Promise<LaborAdicional & { duracion_minutos: number }> {
    const labor = await this.laborDelFontanero(id, user);

    if (labor.estado === 'Finalizado' || labor.estado === 'En revisión') {
      throw new BadRequestException(
        'Esta labor ya fue reportada o finalizada.',
      );
    }

    aplicarTerminoGestion(labor);
    await this.laborRepository.save(labor);

    const actualizada = await this.findOne(id);
    return Object.assign(actualizada, {
      duracion_minutos: calcularDuracionMinutos(
        actualizada.gestion_iniciada_en,
        actualizada.gestion_finalizada_en,
      ),
    });
  }
}
