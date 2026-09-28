import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { ReporteFontanero } from './entities/reporte-fontanero.entity';
import { MaterialReporteFontanero } from './entities/material-reporte-fontanero.entity';
import { CrearReporteFontaneroDto } from './dto/crear-reporte-fontanero.dto';
import { FiltrarReportesFontaneroDto } from './dto/filtrar-reportes-fontanero.dto';
import { Empleado } from '../empleados/entities/empleado.entity';
import { User } from '../auth/entities/user.entity';
import { InventarioService } from '../inventario/inventario.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { ModuloBitacora } from '../bitacora/entities/bitacora.enums';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

const LIMITE_POR_DEFECTO = 25;
const LIMITE_MAXIMO = 100;

@Injectable()
export class ReportesFontaneroService {
  constructor(
    @InjectRepository(ReporteFontanero)
    private readonly reporteRepository: Repository<ReporteFontanero>,
    @InjectRepository(MaterialReporteFontanero)
    private readonly materialRepository: Repository<MaterialReporteFontanero>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly inventarioService: InventarioService,
    private readonly bitacoraService: BitacoraService,
    private readonly dataSource: DataSource,
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
  ): Promise<ReporteFontanero> {
    const empleado = await this.resolverFontanero(user);
    const materiales = dto.materiales ?? [];

    // Un mismo material repetido en la lista se suma: el formulario permite
    // agregar filas y es fácil elegir dos veces lo mismo. Si no se agrupara,
    // se validaría el stock por separado para cada fila y podría pasar una
    // cantidad total mayor a la disponible.
    const cantidadPorArticulo = new Map<number, number>();
    for (const material of materiales) {
      cantidadPorArticulo.set(
        material.articuloId,
        (cantidadPorArticulo.get(material.articuloId) ?? 0) + material.cantidad,
      );
    }

    const autor = await this.autorDe(user.id);
    const nombreFontanero = empleado.nombre;

    // Todo dentro de una transacción: si falla el descuento de cualquier
    // material (por ejemplo, el último se quedó sin stock), no se guarda el
    // reporte ni se descuenta ninguno de los anteriores.
    const reporteGuardado = await this.dataSource.transaction(async (manager) => {
      const reporte = await manager.save(
        ReporteFontanero,
        manager.create(ReporteFontanero, {
          empleado_id: empleado.id,
          tipo_actividad: dto.tipoActividad,
          descripcion: dto.descripcion.trim(),
          fecha_trabajo: dto.fechaTrabajo,
          tiempo_minutos: dto.tiempoMinutos,
          averia_id: dto.averiaId ?? null,
        }),
      );

      for (const [articuloId, cantidad] of cantidadPorArticulo) {
        const { articulo } =
          await this.inventarioService.descontarMaterialEnTransaccion(manager, {
            articuloId,
            cantidad,
            motivo: `Reporte de actividad #${reporte.id} (${nombreFontanero})`,
            responsable: nombreFontanero,
            usuarioId: user.id,
            nombreRegistro: nombreFontanero,
            autor,
          });

        await manager.save(
          MaterialReporteFontanero,
          manager.create(MaterialReporteFontanero, {
            reporte_id: reporte.id,
            articulo_id: articulo.id,
            // Copia del nombre: si el artículo se elimina o se renombra, el
            // reporte histórico sigue diciendo qué se ocupó.
            nombre_articulo: articulo.nombre,
            cantidad,
          }),
        );
      }

      return reporte;
    });

    await this.bitacoraService.registrarCreacion(
      ModuloBitacora.REPORTES_FONTANERO,
      reporteGuardado.id,
      autor,
      `${nombreFontanero} registró una actividad de tipo ${dto.tipoActividad} (${dto.tiempoMinutos} min)`,
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
    const limite = Math.min(filtros.limite ?? LIMITE_POR_DEFECTO, LIMITE_MAXIMO);

    const where: Record<string, unknown> = {};
    if (filtros.empleadoId) where.empleado_id = filtros.empleadoId;
    if (filtros.tipoActividad) where.tipo_actividad = filtros.tipoActividad;

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
      relations: { empleado: true, materiales: true, averia: true },
      order: { fecha_trabajo: 'DESC', id: 'DESC' },
      skip: (pagina - 1) * limite,
      take: limite,
    });

    return { datos, total, pagina, limite };
  }

  async obtenerPorId(id: number): Promise<ReporteFontanero> {
    const reporte = await this.reporteRepository.findOne({
      where: { id },
      relations: { empleado: true, materiales: true, averia: true },
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
      relations: { materiales: true, averia: true },
      order: { fecha_trabajo: 'DESC', id: 'DESC' },
    });
  }
}
