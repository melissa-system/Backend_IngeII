import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { ReporteFontanero } from './entities/reporte-fontanero.entity';
import { CrearReporteFontaneroDto } from './dto/crear-reporte-fontanero.dto';
import { FiltrarReportesFontaneroDto } from './dto/filtrar-reportes-fontanero.dto';
import { RevisarReporteFontaneroDto } from './dto/revisar-reporte-fontanero.dto';
import { EstadoRevisionReporte } from './entities/reporte-fontanero.enums';
import { Empleado } from '../empleados/entities/empleado.entity';
import { Averia } from '../averias/entities/averia.entity';
import { LaborAdicional } from '../labores-adicionales/entities/labor-adicional.entity';
import { User } from '../auth/entities/user.entity';
import { BitacoraService } from '../bitacora/bitacora.service';
import { ModuloBitacora, AccionBitacora } from '../bitacora/entities/bitacora.enums';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { CloudinaryService } from '../../config/cloudinary.service';
import {
  aplicarEnvioRevision,
  aplicarRevision,
} from '../../common/gestion-trabajo/gestion-trabajo';

const LIMITE_POR_DEFECTO = 25;
const LIMITE_MAXIMO = 100;

// Carpeta de Cloudinary donde se guardan las evidencias de los reportes.
const CARPETA_EVIDENCIA = 'ASADA/reportes-fontanero';

@Injectable()
export class ReportesFontaneroService {
  constructor(
    @InjectRepository(ReporteFontanero)
    private readonly reporteRepository: Repository<ReporteFontanero>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly bitacoraService: BitacoraService,
    private readonly dataSource: DataSource,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // El fontanero que firma el reporte sale del usuario autenticado, nunca del
  // formulario: así nadie puede registrar actividad a nombre de otro.
  private async resolverFontanero(user: RequestUser): Promise<Empleado> {
    const empleado = await this.empleadoRepository.findOne({
      where: { usuario: { id: user.id } },
    });

    if (!empleado) {
      throw new BadRequestException(
        'Tu cuenta no está vinculada a un empleado, así que no se puede registrar el reporte. Pídele a la administración que vincule tu cuenta.',
      );
    }

    return empleado;
  }

  private async autorDe(usuarioId: number) {
    const usuario = await this.userRepository.findOneBy({ id: usuarioId });
    return { id: usuarioId, email: usuario?.email ?? null };
  }

  async crear(
    dto: CrearReporteFontaneroDto,
    user: RequestUser,
    evidencia?: Express.Multer.File,
  ): Promise<ReporteFontanero> {
    const empleado = await this.resolverFontanero(user);
    const autor = await this.autorDe(user.id);
    const nombreFontanero = empleado.nombre;

    if (dto.averiaId && dto.laborId) {
      throw new BadRequestException(
        'Un reporte no puede vincularse a una avería y a una labor a la vez.',
      );
    }

    // El material se guarda como texto libre (sin vinculación ni descuento
    // de inventario): la entrada/salida de stock es solo de administración.
    const materialesTexto = dto.materialesTexto?.trim() || null;

    // La avería vinculada debe existir: sin esto, un id manipulado terminaba
    // en un error de llave foránea (500) o en un reporte con un id colgado.
    let averiaVinculada: Averia | null = null;
    if (dto.averiaId) {
      averiaVinculada = await this.dataSource.manager.findOne(Averia, {
        where: { id: dto.averiaId },
        relations: { empleado: true },
      });
      if (!averiaVinculada) {
        throw new NotFoundException(
          `No se encontró la avería #${dto.averiaId} para vincular el reporte.`,
        );
      }
    }

    // La labor vinculada debe existir (y ser del fontanero que reporta).
    let laborVinculada: LaborAdicional | null = null;
    if (dto.laborId) {
      laborVinculada = await this.dataSource.manager.findOne(LaborAdicional, {
        where: { id: dto.laborId },
        relations: { empleado: true },
      });
      if (!laborVinculada) {
        throw new NotFoundException(
          `No se encontró la labor #${dto.laborId} para vincular el reporte.`,
        );
      }
      if (laborVinculada.empleado?.id !== empleado.id) {
        throw new BadRequestException(
          'La labor seleccionada no está asignada a tu cuenta.',
        );
      }
    }

    // Evidencia opcional (una imagen) → Cloudinary. Se sube antes de guardar;
    // si el guardado falla, se borra para no dejar archivos huérfanos.
    const evidenciaSubida = evidencia
      ? await this.cloudinaryService.subirArchivo(evidencia, CARPETA_EVIDENCIA)
      : null;

    // Si este trabajo ya tenía un reporte RECHAZADO del mismo fontanero, se
    // reutiliza esa fila en vez de crear una nueva: el reenvío "cae sobre" el
    // reporte anterior y no se acumulan duplicados.
    const filtroAnterior = dto.averiaId
      ? { averia_id: dto.averiaId, empleado_id: empleado.id }
      : dto.laborId
        ? { labor_id: dto.laborId, empleado_id: empleado.id }
        : null;
    const reporteAnterior = filtroAnterior
      ? await this.reporteRepository.findOne({
          where: filtroAnterior,
          order: { id: 'DESC' },
        })
      : null;
    const reutiliza =
      !!reporteAnterior &&
      reporteAnterior.estado_revision === EstadoRevisionReporte.RECHAZADO;

    let reporteGuardado: ReporteFontanero;
    try {
      if (reutiliza && reporteAnterior) {
        const evidenciaAnteriorPublicId = reporteAnterior.evidencia_public_id;

        reporteAnterior.tipo_actividad = dto.tipoActividad;
        reporteAnterior.descripcion = dto.descripcion.trim();
        reporteAnterior.fecha_trabajo = dto.fechaTrabajo;
        reporteAnterior.tiempo_minutos = dto.tiempoMinutos;
        reporteAnterior.materiales_texto = materialesTexto;
        reporteAnterior.averia_id = dto.averiaId ?? null;
        reporteAnterior.labor_id = dto.laborId ?? null;
        if (evidenciaSubida) {
          reporteAnterior.evidencia_url = evidenciaSubida.url;
          reporteAnterior.evidencia_public_id = evidenciaSubida.publicId;
          reporteAnterior.evidencia_nombre = evidencia?.originalname ?? null;
        }
        // Vuelve a quedar pendiente y cuenta el reintento.
        reporteAnterior.estado_revision = EstadoRevisionReporte.PENDIENTE;
        reporteAnterior.reintentos = (reporteAnterior.reintentos ?? 0) + 1;

        reporteGuardado = await this.reporteRepository.save(reporteAnterior);

        // Si se reemplazó la evidencia, se borra la anterior (best-effort).
        if (evidenciaSubida && evidenciaAnteriorPublicId) {
          await this.cloudinaryService.eliminarArchivo(
            evidenciaAnteriorPublicId,
          );
        }
      } else {
        reporteGuardado = await this.dataSource.transaction(async (manager) =>
          manager.save(
            ReporteFontanero,
            manager.create(ReporteFontanero, {
              empleado_id: empleado.id,
              tipo_actividad: dto.tipoActividad,
              descripcion: dto.descripcion.trim(),
              fecha_trabajo: dto.fechaTrabajo,
              tiempo_minutos: dto.tiempoMinutos,
              averia_id: dto.averiaId ?? null,
              labor_id: dto.laborId ?? null,
              materiales_texto: materialesTexto,
              evidencia_url: evidenciaSubida?.url ?? null,
              evidencia_public_id: evidenciaSubida?.publicId ?? null,
              evidencia_nombre: evidencia?.originalname ?? null,
              // Todo reporte queda pendiente de la revisión de la
              // administración (con o sin avería/labor vinculada).
              estado_revision: EstadoRevisionReporte.PENDIENTE,
            }),
          ),
        );
      }
    } catch (error) {
      if (evidenciaSubida) {
        await this.cloudinaryService.eliminarArchivo(evidenciaSubida.publicId);
      }
      throw error;
    }

    // El trabajo vinculado queda "En revisión": la resolución NO la cierra el
    // fontanero. La administración la aprueba (Finalizado) o la rechaza
    // (En proceso) desde el panel de reportes.
    if (
      averiaVinculada &&
      averiaVinculada.empleado?.id === empleado.id &&
      averiaVinculada.estado !== 'Finalizado'
    ) {
      const estadoAnterior = averiaVinculada.estado;
      aplicarEnvioRevision(averiaVinculada);
      await this.dataSource.manager.save(Averia, averiaVinculada);
      await this.bitacoraService.registrarCambioEstado(
        ModuloBitacora.AVERIAS,
        averiaVinculada.id,
        autor,
        estadoAnterior,
        'En revisión',
        'El fontanero registró el reporte; queda a revisión de la administración.',
      );
    }

    if (
      laborVinculada &&
      laborVinculada.empleado?.id === empleado.id &&
      laborVinculada.estado !== 'Finalizado'
    ) {
      const estadoAnterior = laborVinculada.estado;
      aplicarEnvioRevision(laborVinculada);
      await this.dataSource.manager.save(LaborAdicional, laborVinculada);
      await this.bitacoraService.registrarCambioEstado(
        ModuloBitacora.LABORES_ADICIONALES,
        laborVinculada.id,
        autor,
        estadoAnterior,
        'En revisión',
        'El fontanero registró el reporte de la labor; queda a revisión de la administración.',
      );
    }

    const detalleTrabajo = dto.averiaId
      ? 'de la avería'
      : dto.laborId
        ? 'de la labor'
        : '';

    await this.bitacoraService.registrarCreacion(
      ModuloBitacora.REPORTES_FONTANERO,
      reporteGuardado.id,
      autor,
      reutiliza
        ? `${nombreFontanero} reenvió el reporte ${detalleTrabajo} (intento ${reporteGuardado.reintentos})`.trim()
        : `${nombreFontanero} registró una actividad de tipo ${dto.tipoActividad} (${dto.tiempoMinutos} min)`,
    );

    return this.obtenerPorId(reporteGuardado.id);
  }

  async buscar(filtros: FiltrarReportesFontaneroDto): Promise<{
    datos: ReporteFontanero[];
    total: number;
    pagina: number;
    limite: number;
  }> {
    const pagina = filtros.pagina ?? 1;
    const limite = Math.min(
      filtros.limite ?? LIMITE_POR_DEFECTO,
      LIMITE_MAXIMO,
    );

    const where: Record<string, unknown> = {};
    if (filtros.empleadoId) where.empleado_id = filtros.empleadoId;
    if (filtros.tipoActividad) where.tipo_actividad = filtros.tipoActividad;
    if (filtros.estadoRevision) where.estado_revision = filtros.estadoRevision;

    // fecha_trabajo es un DATE (solo día), así que el filtro compara textos
    // 'YYYY-MM-DD' y no hace falta ajustar horas ni zona horaria.
    if (filtros.desde && filtros.hasta) {
      where.fecha_trabajo = Between(filtros.desde, filtros.hasta);
    } else if (filtros.desde) {
      where.fecha_trabajo = MoreThanOrEqual(filtros.desde);
    } else if (filtros.hasta) {
      where.fecha_trabajo = LessThanOrEqual(filtros.hasta);
    }

    // Sin coincidencias devuelve una lista vacía, no un error: para el panel
    // "no hay reportes de este fontanero" es un resultado válido.
    const [datos, total] = await this.reporteRepository.findAndCount({
      where,
      relations: { empleado: true, materiales: true, averia: true, labor: true },
      order: { fecha_trabajo: 'DESC', id: 'DESC' },
      skip: (pagina - 1) * limite,
      take: limite,
    });

    return { datos, total, pagina, limite };
  }

  async obtenerPorId(id: number): Promise<ReporteFontanero> {
    const reporte = await this.reporteRepository.findOne({
      where: { id },
      relations: { empleado: true, materiales: true, averia: true, labor: true },
    });

    if (!reporte) {
      throw new NotFoundException(`El reporte #${id} no fue encontrado`);
    }

    return reporte;
  }

  // Reportes del fontanero autenticado, para su propia pantalla.
  async misReportes(user: RequestUser): Promise<ReporteFontanero[]> {
    const empleado = await this.resolverFontanero(user);
    return this.reporteRepository.find({
      where: { empleado_id: empleado.id },
      relations: { materiales: true, averia: true, labor: true },
      order: { fecha_trabajo: 'DESC', id: 'DESC' },
    });
  }

  // Aprobar o rechazar la resolución de la avería a partir del reporte del
  // fontanero. Solo la administración llega acá (lo controla el controller).
  // Aprobar deja la avería "Finalizado"; rechazar la devuelve a "En proceso" y
  // limpia las marcas del cronómetro para que el fontanero pueda retomarla sin
  // arrastrar el tiempo anterior.
  async revisar(
    id: number,
    dto: RevisarReporteFontaneroDto,
    user: RequestUser,
  ): Promise<ReporteFontanero> {
    const reporte = await this.obtenerPorId(id);
    const autor = await this.autorDe(user.id);
    const nuevoEstado = dto.aprobado
      ? EstadoRevisionReporte.APROBADO
      : EstadoRevisionReporte.RECHAZADO;

    if (reporte.estado_revision !== nuevoEstado) {
      const anterior = reporte.estado_revision;
      reporte.estado_revision = nuevoEstado;
      await this.reporteRepository.save(reporte);
      await this.bitacoraService.registrar({
        modulo: ModuloBitacora.REPORTES_FONTANERO,
        registro_id: reporte.id,
        accion: AccionBitacora.EDICION,
        autor,
        campo: 'estado_revision',
        valor_anterior: anterior,
        valor_nuevo: nuevoEstado,
        observaciones: dto.observacion ?? null,
      });
    }

    if (reporte.averia_id) {
      const averia = await this.dataSource.manager.findOne(Averia, {
        where: { id: reporte.averia_id },
      });
      if (averia && averia.estado !== 'Finalizado') {
        const estadoAnterior = averia.estado;
        aplicarRevision(averia, dto.aprobado, dto.observacion);
        await this.dataSource.manager.save(Averia, averia);
        await this.bitacoraService.registrarCambioEstado(
          ModuloBitacora.AVERIAS,
          averia.id,
          autor,
          estadoAnterior,
          averia.estado,
          dto.observacion ||
            (dto.aprobado
              ? 'Resolución de la avería aprobada por la administración.'
              : 'Resolución rechazada; la avería vuelve a estar en proceso.'),
        );
      }
    } else if (reporte.labor_id) {
      const labor = await this.dataSource.manager.findOne(LaborAdicional, {
        where: { id: reporte.labor_id },
      });
      if (labor && labor.estado !== 'Finalizado') {
        const estadoAnterior = labor.estado;
        aplicarRevision(labor, dto.aprobado, dto.observacion);
        await this.dataSource.manager.save(LaborAdicional, labor);
        await this.bitacoraService.registrarCambioEstado(
          ModuloBitacora.LABORES_ADICIONALES,
          labor.id,
          autor,
          estadoAnterior,
          labor.estado,
          dto.observacion ||
            (dto.aprobado
              ? 'Resolución de la labor aprobada por la administración.'
              : 'Resolución rechazada; la labor vuelve a estar en proceso.'),
        );
      }
    }

    return this.obtenerPorId(id);
  }
}
