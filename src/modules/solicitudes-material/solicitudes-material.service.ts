import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { SolicitudMaterial } from './entities/solicitud-material.entity';
import { DetalleSolicitudMaterial } from './entities/detalle-solicitud-material.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { Averia } from '../averias/entities/averia.entity';
import { LaborAdicional } from '../labores-adicionales/entities/labor-adicional.entity';
import { Articulo } from '../inventario/entities/articulo.entity';
import { User } from '../auth/entities/user.entity';
import { InventarioService } from '../inventario/inventario.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import {
  AccionBitacora,
  ModuloBitacora,
} from '../bitacora/entities/bitacora.enums';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { CrearSolicitudMaterialDto } from './dto/crear-solicitud-material.dto';
import { RechazarSolicitudMaterialDto } from './dto/rechazar-solicitud-material.dto';

// Trabajos que ya no admiten pedir materiales: el fontanero ya reportó y la
// administración está revisando (o el trabajo se cerró).
const ESTADOS_SIN_MATERIALES = ['En revisión', 'Finalizado'];

export interface ArticuloCatalogo {
  id: number;
  nombre: string;
  clasificacion: string;
  cantidad_disponible: number;
  ubicacion: string;
}

@Injectable()
export class SolicitudesMaterialService {
  constructor(
    @InjectRepository(SolicitudMaterial)
    private readonly solicitudRepository: Repository<SolicitudMaterial>,
    @InjectRepository(DetalleSolicitudMaterial)
    private readonly detalleRepository: Repository<DetalleSolicitudMaterial>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(Averia)
    private readonly averiaRepository: Repository<Averia>,
    @InjectRepository(LaborAdicional)
    private readonly laborRepository: Repository<LaborAdicional>,
    @InjectRepository(Articulo)
    private readonly articuloRepository: Repository<Articulo>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly inventarioService: InventarioService,
    private readonly bitacoraService: BitacoraService,
    private readonly dataSource: DataSource,
  ) {}

  private async autorDe(usuarioId: number) {
    const usuario = await this.userRepository.findOneBy({ id: usuarioId });
    return { id: usuarioId, email: usuario?.email ?? null };
  }

  private async resolverEmpleado(user: RequestUser): Promise<Empleado> {
    const empleado = await this.empleadoRepository.findOne({
      where: { usuario: { id: user.id } },
    });
    if (!empleado) {
      throw new NotFoundException(
        'No se encontró un empleado vinculado a esta cuenta',
      );
    }
    return empleado;
  }

  private async generarCodigoUnico(): Promise<string> {
    const anio = new Date().getFullYear();
    for (;;) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const codigo = `SM-${anio}-${randomNum}`;
      const existente = await this.solicitudRepository.findOneBy({
        codigo_solicitud_material: codigo,
      });
      if (!existente) return codigo;
    }
  }

  private async findOne(id: number): Promise<SolicitudMaterial> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id },
      relations: {
        empleado: true,
        averia: true,
        labor: true,
        detalles: { articulo: true },
      },
    });
    if (!solicitud) {
      throw new NotFoundException(
        `La solicitud de material #${id} no fue encontrada`,
      );
    }
    return solicitud;
  }

  // Valida que el trabajo exista, sea del fontanero y siga abierto. Devuelve
  // la avería o la labor (nunca ambas).
  private async resolverTrabajo(
    dto: CrearSolicitudMaterialDto,
    empleado: Empleado,
  ): Promise<{ averia: Averia | null; labor: LaborAdicional | null }> {
    if (!!dto.averiaId === !!dto.laborId) {
      throw new BadRequestException(
        'Indicá una avería o una labor para la solicitud (solo una de las dos)',
      );
    }

    if (dto.averiaId) {
      const averia = await this.averiaRepository.findOne({
        where: { id: dto.averiaId },
        relations: { empleado: true },
      });
      if (!averia) {
        throw new NotFoundException(`La avería #${dto.averiaId} no existe`);
      }
      if (averia.empleado?.id !== empleado.id) {
        throw new ForbiddenException(
          'Esa avería no está asignada a tu cuenta.',
        );
      }
      if (ESTADOS_SIN_MATERIALES.includes(averia.estado)) {
        throw new BadRequestException(
          'Esa avería ya fue reportada y no admite solicitudes de material.',
        );
      }
      return { averia, labor: null };
    }

    const labor = await this.laborRepository.findOne({
      where: { id: dto.laborId },
      relations: { empleado: true },
    });
    if (!labor) {
      throw new NotFoundException(`La labor #${dto.laborId} no existe`);
    }
    if (labor.empleado?.id !== empleado.id) {
      throw new ForbiddenException('Esa labor no está asignada a tu cuenta.');
    }
    if (ESTADOS_SIN_MATERIALES.includes(labor.estado)) {
      throw new BadRequestException(
        'Esa labor ya fue reportada y no admite solicitudes de material.',
      );
    }
    return { averia: null, labor };
  }

  async crear(
    dto: CrearSolicitudMaterialDto,
    user: RequestUser,
  ): Promise<SolicitudMaterial> {
    const empleado = await this.resolverEmpleado(user);
    const { averia, labor } = await this.resolverTrabajo(dto, empleado);

    // Solo una solicitud pendiente por trabajo: evita pedidos duplicados
    // mientras la administración revisa el primero.
    const pendiente = await this.solicitudRepository.findOne({
      where: {
        estado: 'Pendiente',
        ...(averia ? { averia: { id: averia.id } } : { labor: { id: labor!.id } }),
      },
    });
    if (pendiente) {
      throw new BadRequestException(
        `Ya hay una solicitud de material pendiente para este trabajo (${pendiente.codigo_solicitud_material}).`,
      );
    }

    // Ítems: del catálogo (con stock disponible como referencia, sin exigir
    // que alcance: si falta, la administración compra) o libres.
    const detalles: DetalleSolicitudMaterial[] = [];
    const articulosUsados = new Set<number>();
    for (const item of dto.items) {
      if (item.articuloId) {
        if (articulosUsados.has(item.articuloId)) {
          throw new BadRequestException(
            'No repitas el mismo material en la solicitud: sumá la cantidad en una sola línea.',
          );
        }
        articulosUsados.add(item.articuloId);

        const articulo = await this.articuloRepository.findOneBy({
          id: item.articuloId,
        });
        if (!articulo) {
          throw new NotFoundException(
            `El material #${item.articuloId} no existe en el inventario`,
          );
        }
        if (articulo.estado === 'inactivo') {
          throw new BadRequestException(
            `El material "${articulo.nombre}" está inactivo y no se puede solicitar`,
          );
        }

        detalles.push(
          this.detalleRepository.create({
            articulo,
            descripcion_libre: null,
            unidad: null,
            cantidad: item.cantidad,
          }),
        );
      } else {
        if (!item.descripcionLibre) {
          throw new BadRequestException(
            'Cada material debe venir del inventario o tener una descripción.',
          );
        }
        detalles.push(
          this.detalleRepository.create({
            articulo: null,
            descripcion_libre: item.descripcionLibre,
            unidad: item.unidad ?? null,
            cantidad: item.cantidad,
          }),
        );
      }
    }

    const solicitud = this.solicitudRepository.create({
      codigo_solicitud_material: await this.generarCodigoUnico(),
      empleado,
      averia,
      id_averia: averia?.id ?? null,
      labor,
      id_labor: labor?.id ?? null,
      estado: 'Pendiente',
      motivo: dto.motivo.trim(),
      motivo_rechazo: null,
      revisado_por: null,
      fecha_revision: null,
    });
    const guardada = await this.solicitudRepository.save(solicitud);

    for (const detalle of detalles) {
      detalle.solicitud = guardada;
    }
    await this.detalleRepository.save(detalles);

    const codigoTrabajo =
      averia?.codigo_averia ?? labor?.codigo_labor ?? 'trabajo';
    await this.bitacoraService.registrarCreacion(
      ModuloBitacora.SOLICITUDES_MATERIAL,
      guardada.id,
      await this.autorDe(user.id),
      `Solicitud de material ${guardada.codigo_solicitud_material} creada para ${codigoTrabajo}`,
    );

    return this.findOne(guardada.id);
  }

  async misSolicitudes(user: RequestUser): Promise<SolicitudMaterial[]> {
    const empleado = await this.resolverEmpleado(user);
    return this.solicitudRepository.find({
      where: { empleado: { id: empleado.id } },
      relations: {
        empleado: true,
        averia: true,
        labor: true,
        detalles: { articulo: true },
      },
      order: { fecha_creacion: 'ASC', id: 'ASC' },
    });
  }

  // Bandeja de la administración y la Junta Directiva.
  async listar(filtros: {
    estado?: string;
    busqueda?: string;
  }): Promise<SolicitudMaterial[]> {
    const query = this.solicitudRepository
      .createQueryBuilder('solicitud')
      .leftJoinAndSelect('solicitud.empleado', 'empleado')
      .leftJoinAndSelect('solicitud.averia', 'averia')
      .leftJoinAndSelect('solicitud.labor', 'labor')
      .leftJoinAndSelect('solicitud.detalles', 'detalle')
      .leftJoinAndSelect('detalle.articulo', 'articulo')
      .orderBy('solicitud.fecha_creacion', 'ASC')
      .addOrderBy('solicitud.id', 'ASC');

    if (filtros.estado && filtros.estado !== 'Todos') {
      query.andWhere('solicitud.estado = :estado', {
        estado: filtros.estado,
      });
    }

    if (filtros.busqueda?.trim()) {
      const q = `%${filtros.busqueda.trim()}%`;
      query.andWhere(
        '(solicitud.codigo_solicitud_material LIKE :q OR empleado.nombre LIKE :q OR averia.codigo_averia LIKE :q OR labor.codigo_labor LIKE :q)',
        { q },
      );
    }

    return query.getMany();
  }

  // Catálogo que ve el fontanero: solo artículos activos, con el stock como
  // referencia para saber si conviene pedir de más (y disparar la compra).
  async catalogo(): Promise<ArticuloCatalogo[]> {
    const articulos = await this.articuloRepository.find({
      where: { estado: 'activo' },
      order: { nombre: 'ASC' },
    });
    return articulos.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      clasificacion: a.clasificacion,
      cantidad_disponible: a.cantidad_disponible,
      ubicacion: a.ubicacion,
    }));
  }

  // Vincula un material libre ("Otro") a un artículo del inventario. La
  // administración lo hace antes de aprobar, para que la entrega descuente
  // stock y quede registrada.
  async vincularDetalle(
    id: number,
    detalleId: number,
    articuloId: number,
    user: RequestUser,
  ): Promise<SolicitudMaterial> {
    const solicitud = await this.findOne(id);
    if (solicitud.estado !== 'Pendiente') {
      throw new BadRequestException(
        'Solo se pueden vincular materiales de una solicitud pendiente.',
      );
    }

    const detalle = solicitud.detalles.find((d) => d.id === detalleId);
    if (!detalle) {
      throw new NotFoundException(
        'El material no pertenece a esta solicitud de material.',
      );
    }

    const articulo = await this.articuloRepository.findOneBy({
      id: articuloId,
    });
    if (!articulo) {
      throw new NotFoundException(`El artículo #${articuloId} no existe`);
    }
    if (articulo.estado === 'inactivo') {
      throw new BadRequestException(
        `El material "${articulo.nombre}" está inactivo y no se puede entregar`,
      );
    }

    const anterior = detalle.articulo?.nombre ?? detalle.descripcion_libre;
    detalle.articulo = articulo;
    await this.detalleRepository.save(detalle);

    await this.bitacoraService.registrar({
      modulo: ModuloBitacora.SOLICITUDES_MATERIAL,
      registro_id: solicitud.id,
      accion: AccionBitacora.EDICION,
      autor: await this.autorDe(user.id),
      campo: 'material',
      valor_anterior: anterior ?? null,
      valor_nuevo: articulo.nombre,
      observaciones: `Material de la solicitud ${solicitud.codigo_solicitud_material} vinculado al inventario.`,
    });

    return this.findOne(id);
  }

  async aprobar(id: number, user: RequestUser): Promise<SolicitudMaterial> {
    const solicitud = await this.findOne(id);
    if (solicitud.estado !== 'Pendiente') {
      throw new BadRequestException(
        'La solicitud ya fue revisada y no admite más cambios.',
      );
    }

    const sinVincular = solicitud.detalles.filter((d) => !d.articulo);
    if (sinVincular.length > 0) {
      const lista = sinVincular
        .map((d) => d.descripcion_libre ?? `material #${d.id}`)
        .join(', ');
      throw new BadRequestException(
        `Antes de aprobar, vinculá al inventario: ${lista}.`,
      );
    }

    const inactivos = solicitud.detalles.filter(
      (d) => d.articulo!.estado === 'inactivo',
    );
    if (inactivos.length > 0) {
      throw new BadRequestException(
        `Estos materiales están inactivos: ${inactivos
          .map((d) => d.articulo!.nombre)
          .join(', ')}. Reactivalos en Inventario antes de aprobar.`,
      );
    }

    // Se valida todo antes de descontar: si falta stock, no se toca nada y el
    // mensaje dice exactamente qué comprar.
    const faltantes = solicitud.detalles.filter(
      (d) => d.articulo!.cantidad_disponible < d.cantidad,
    );
    if (faltantes.length > 0) {
      const detalle = faltantes
        .map(
          (d) =>
            `${d.articulo!.nombre} (hay ${d.articulo!.cantidad_disponible}, se piden ${d.cantidad})`,
        )
        .join('; ');
      throw new BadRequestException(
        `No hay stock suficiente de: ${detalle}. Registrá la entrada en Inventario y volvé a intentar.`,
      );
    }

    const usuario = await this.userRepository.findOneBy({ id: user.id });
    const autor = await this.autorDe(user.id);
    const nombreRegistro =
      usuario?.username ?? usuario?.email ?? 'Administrador';
    const codigoTrabajo =
      solicitud.averia?.codigo_averia ??
      solicitud.labor?.codigo_labor ??
      'trabajo';

    await this.dataSource.transaction(async (manager) => {
      for (const detalle of solicitud.detalles) {
        await this.inventarioService.descontarMaterialEnTransaccion(manager, {
          articuloId: detalle.articulo!.id,
          cantidad: detalle.cantidad,
          motivo: `Solicitud de material ${solicitud.codigo_solicitud_material} — ${codigoTrabajo}`,
          responsable: solicitud.empleado?.nombre ?? null,
          usuarioId: user.id,
          nombreRegistro,
          autor,
        });
      }

      solicitud.estado = 'Aprobada';
      solicitud.revisado_por = usuario ?? null;
      solicitud.fecha_revision = new Date();
      await manager.save(SolicitudMaterial, solicitud);
    });

    await this.bitacoraService.registrarCambioEstado(
      ModuloBitacora.SOLICITUDES_MATERIAL,
      solicitud.id,
      autor,
      'Pendiente',
      'Aprobada',
      `Solicitud ${solicitud.codigo_solicitud_material} aprobada: se descontó el stock de ${solicitud.detalles.length} material(es).`,
    );

    return this.findOne(id);
  }

  async rechazar(
    id: number,
    dto: RechazarSolicitudMaterialDto,
    user: RequestUser,
  ): Promise<SolicitudMaterial> {
    const solicitud = await this.findOne(id);
    if (solicitud.estado !== 'Pendiente') {
      throw new BadRequestException(
        'La solicitud ya fue revisada y no admite más cambios.',
      );
    }

    const usuario = await this.userRepository.findOneBy({ id: user.id });
    solicitud.estado = 'Rechazada';
    solicitud.motivo_rechazo = dto.motivoRechazo.trim();
    solicitud.revisado_por = usuario ?? null;
    solicitud.fecha_revision = new Date();
    await this.solicitudRepository.save(solicitud);

    await this.bitacoraService.registrarCambioEstado(
      ModuloBitacora.SOLICITUDES_MATERIAL,
      solicitud.id,
      await this.autorDe(user.id),
      'Pendiente',
      'Rechazada',
      dto.motivoRechazo.trim(),
    );

    return this.findOne(id);
  }

  // El fontanero puede cancelar su propia solicitud mientras siga pendiente
  // (por ejemplo, si consiguió los materiales por otra vía).
  async cancelar(id: number, user: RequestUser): Promise<SolicitudMaterial> {
    const solicitud = await this.findOne(id);
    if (solicitud.estado !== 'Pendiente') {
      throw new BadRequestException(
        'Solo se puede cancelar una solicitud pendiente.',
      );
    }

    const empleado = await this.resolverEmpleado(user);
    if (solicitud.empleado.id !== empleado.id) {
      throw new ForbiddenException('Esta solicitud no te pertenece.');
    }

    solicitud.estado = 'Cancelada';
    await this.solicitudRepository.save(solicitud);

    await this.bitacoraService.registrarCambioEstado(
      ModuloBitacora.SOLICITUDES_MATERIAL,
      solicitud.id,
      await this.autorDe(user.id),
      'Pendiente',
      'Cancelada',
      'El fontanero canceló su solicitud de material.',
    );

    return this.findOne(id);
  }

  // Usado por averías y labores para no dejar iniciar la gestión mientras el
  // pedido de materiales siga esperando respuesta.
  async tienePendiente(
    averiaId?: number | null,
    laborId?: number | null,
  ): Promise<boolean> {
    if (!averiaId && !laborId) return false;
    const where: FindOptionsWhere<SolicitudMaterial> = {
      estado: 'Pendiente',
      ...(averiaId
        ? { averia: { id: averiaId } }
        : { labor: { id: laborId! } }),
    };
    const existe = await this.solicitudRepository.findOne({ where });
    return !!existe;
  }
}
