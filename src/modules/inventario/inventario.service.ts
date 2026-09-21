import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like } from 'typeorm';
import { Articulo } from './entities/articulo.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { User } from '../auth/entities/user.entity';
import { BitacoraService } from '../bitacora/bitacora.service';
import {
  ModuloBitacora,
  AccionBitacora,
} from '../bitacora/entities/bitacora.enums';
import { CrearArticuloDto } from './dto/crear-articulo.dto';
import { ActualizarArticuloDto } from './dto/actualizar-articulo.dto';
import { RegistrarMovimientoDto } from './dto/registrar-movimiento.dto';
import { CrearProveedorDto } from './dto/crear-proveedor.dto';
import { ActualizarProveedorDto } from './dto/actualizar-proveedor.dto';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Injectable()
export class InventarioService {
  constructor(
    @InjectRepository(Articulo)
    private readonly articuloRepository: Repository<Articulo>,
    @InjectRepository(MovimientoInventario)
    private readonly movimientoRepository: Repository<MovimientoInventario>,
    @InjectRepository(Proveedor)
    private readonly proveedorRepository: Repository<Proveedor>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly bitacoraService: BitacoraService,
    private readonly dataSource: DataSource,
  ) {}

  private async resolverAutor(user: RequestUser) {
    const usuarioAutor = await this.userRepository.findOne({
      where: { id: user.id },
    });
    const email = (user as any).email ?? usuarioAutor?.email ?? null;
    const nombre = usuarioAutor?.username ?? usuarioAutor?.email ?? 'Administrador';
    return {
      autor: { id: user.id, email },
      nombre,
    };
  }

  // ------------------------------------------------------------------
  // ARTÍCULOS
  // ------------------------------------------------------------------

  async crearArticulo(dto: CrearArticuloDto, user: RequestUser): Promise<Articulo> {
    const proveedor = await this.proveedorRepository.findOne({
      where: { id: dto.proveedorId },
    });

    if (!proveedor) {
      throw new NotFoundException('El proveedor especificado no existe');
    }

    const { autor, nombre: nombreRegistro } = await this.resolverAutor(user);

    const articulo = this.articuloRepository.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      clasificacion: dto.clasificacion,
      cantidad_disponible: dto.cantidad,
      fecha_ingreso: dto.fechaIngreso || new Date().toISOString().slice(0, 10),
      ubicacion: dto.ubicacion,
      persona_recibe: dto.personaRecibe,
      estado: 'activo',
      proveedor,
    });

    const articuloGuardado = await this.articuloRepository.save(articulo);

    // Si tiene cantidad inicial, registrar movimiento inicial de entrada
    if (dto.cantidad > 0) {
      const movimientoInicial = this.movimientoRepository.create({
        articulo: articuloGuardado,
        tipo_movimiento: 'entrada',
        cantidad: dto.cantidad,
        responsable_destino: null,
        motivo: 'Inventario inicial al registrar artículo',
        usuario_id: user.id,
        nombre_persona_registro: nombreRegistro,
      });
      await this.movimientoRepository.save(movimientoInicial);
    }

    // Registrar en Bitácora transversal
    await this.bitacoraService.registrarCreacion(
      ModuloBitacora.INVENTARIO,
      articuloGuardado.id,
      autor,
      `Artículo "${articuloGuardado.nombre}" creado con stock inicial de ${articuloGuardado.cantidad_disponible} unidades`,
    );

    return articuloGuardado;
  }

  async listarArticulos(filtros?: {
    busqueda?: string;
    clasificacion?: string;
    estado?: string;
  }): Promise<Articulo[]> {
    const query = this.articuloRepository
      .createQueryBuilder('articulo')
      .leftJoinAndSelect('articulo.proveedor', 'proveedor')
      .orderBy('articulo.id', 'DESC');

    if (filtros?.busqueda?.trim()) {
      const q = `%${filtros.busqueda.trim().toLowerCase()}%`;
      query.andWhere(
        '(LOWER(articulo.nombre) LIKE :q OR LOWER(articulo.descripcion) LIKE :q OR LOWER(proveedor.nombre) LIKE :q)',
        { q },
      );
    }

    if (filtros?.clasificacion && filtros.clasificacion !== 'Todas') {
      query.andWhere('articulo.clasificacion = :clasificacion', {
        clasificacion: filtros.clasificacion,
      });
    }

    if (filtros?.estado && filtros.estado !== 'Todos') {
      query.andWhere('articulo.estado = :estado', {
        estado: filtros.estado.toLowerCase(),
      });
    }

    return query.getMany();
  }

  async obtenerArticuloPorId(id: number): Promise<Articulo> {
    const articulo = await this.articuloRepository.findOne({
      where: { id },
      relations: { proveedor: true, movimientos: true },
    });

    if (!articulo) {
      throw new NotFoundException(`El artículo con ID #${id} no fue encontrado`);
    }

    return articulo;
  }

  async actualizarArticulo(
    id: number,
    dto: ActualizarArticuloDto,
    user: RequestUser,
  ): Promise<Articulo> {
    const articulo = await this.obtenerArticuloPorId(id);
    const { autor } = await this.resolverAutor(user);

    let proveedor = articulo.proveedor;
    if (dto.proveedorId && dto.proveedorId !== articulo.proveedor.id) {
      const nuevoProveedor = await this.proveedorRepository.findOne({
        where: { id: dto.proveedorId },
      });
      if (!nuevoProveedor) {
        throw new NotFoundException('El proveedor especificado no existe');
      }
      proveedor = nuevoProveedor;
    }

    const antes: Record<string, unknown> = {
      nombre: articulo.nombre,
      descripcion: articulo.descripcion,
      clasificacion: articulo.clasificacion,
      ubicacion: articulo.ubicacion,
      persona_recibe: articulo.persona_recibe,
      proveedor_id: articulo.proveedor?.id,
      estado: articulo.estado,
    };

    if (dto.nombre !== undefined) articulo.nombre = dto.nombre;
    if (dto.descripcion !== undefined) articulo.descripcion = dto.descripcion;
    if (dto.clasificacion !== undefined) articulo.clasificacion = dto.clasificacion;
    if (dto.ubicacion !== undefined) articulo.ubicacion = dto.ubicacion;
    if (dto.personaRecibe !== undefined) articulo.persona_recibe = dto.personaRecibe;
    if (dto.estado !== undefined) articulo.estado = dto.estado;
    articulo.proveedor = proveedor;

    const actualizado = await this.articuloRepository.save(articulo);

    const despues: Record<string, unknown> = {
      nombre: actualizado.nombre,
      descripcion: actualizado.descripcion,
      clasificacion: actualizado.clasificacion,
      ubicacion: actualizado.ubicacion,
      persona_recibe: actualizado.persona_recibe,
      proveedor_id: actualizado.proveedor?.id,
      estado: actualizado.estado,
    };

    const cambios = BitacoraService.compararCampos(antes, despues, [
      'nombre',
      'descripcion',
      'clasificacion',
      'ubicacion',
      'persona_recibe',
      'proveedor_id',
      'estado',
    ]);

    if (cambios.length > 0) {
      await this.bitacoraService.registrarEdicion(
        ModuloBitacora.INVENTARIO,
        actualizado.id,
        autor,
        cambios,
      );
    }

    return actualizado;
  }

  async registrarMovimiento(
    id: number,
    dto: RegistrarMovimientoDto,
    user: RequestUser,
  ): Promise<{ articulo: Articulo; movimiento: MovimientoInventario }> {
    const { autor, nombre: nombreRegistro } = await this.resolverAutor(user);

    return await this.dataSource.transaction(async (manager) => {
      const articulo = await manager.findOne(Articulo, {
        where: { id },
        relations: { proveedor: true },
      });

      if (!articulo) {
        throw new NotFoundException(`El artículo con ID #${id} no existe`);
      }

      if (articulo.estado === 'inactivo') {
        throw new BadRequestException(
          'No se pueden registrar movimientos en un artículo inactivo',
        );
      }

      const stockAnterior = articulo.cantidad_disponible;

      if (dto.tipoMovimiento === 'salida') {
        if (articulo.cantidad_disponible < dto.cantidad) {
          throw new BadRequestException(
            `Stock insuficiente. Cantidad disponible: ${articulo.cantidad_disponible}, solicitada: ${dto.cantidad}`,
          );
        }
        articulo.cantidad_disponible -= dto.cantidad;
        if (dto.responsableDestino) {
          articulo.ubicacion = dto.responsableDestino;
        }
      } else if (dto.tipoMovimiento === 'entrada') {
        articulo.cantidad_disponible += dto.cantidad;
      }

      const articuloActualizado = await manager.save(Articulo, articulo);

      const nuevoMovimiento = manager.create(MovimientoInventario, {
        articulo: articuloActualizado,
        tipo_movimiento: dto.tipoMovimiento,
        cantidad: dto.cantidad,
        responsable_destino: dto.responsableDestino || null,
        motivo: dto.motivo,
        usuario_id: user.id,
        nombre_persona_registro: nombreRegistro,
      });

      const movimientoGuardado = await manager.save(
        MovimientoInventario,
        nuevoMovimiento,
      );

      // Registrar auditoría en Bitácora general
      await this.bitacoraService.registrar({
        modulo: ModuloBitacora.INVENTARIO,
        registro_id: articuloActualizado.id,
        accion: AccionBitacora.EDICION,
        autor,
        campo: 'cantidad_disponible',
        valor_anterior: String(stockAnterior),
        valor_nuevo: String(articuloActualizado.cantidad_disponible),
        observaciones: `${dto.tipoMovimiento.toUpperCase()}: ${dto.cantidad} uds. Motivo: ${dto.motivo}${
          dto.responsableDestino ? ` - Destino/Responsable: ${dto.responsableDestino}` : ''
        }`,
      });

      return {
        articulo: articuloActualizado,
        movimiento: movimientoGuardado,
      };
    });
  }

  async obtenerHistorialArticulo(id: number): Promise<MovimientoInventario[]> {
    const articulo = await this.articuloRepository.findOne({ where: { id } });
    if (!articulo) {
      throw new NotFoundException(`El artículo con ID #${id} no existe`);
    }

    return this.movimientoRepository.find({
      where: { articulo: { id } },
      order: { fecha_movimiento: 'DESC' },
    });
  }

  async listarTodosLosMovimientos(filtros?: {
    tipo?: string;
    busqueda?: string;
  }): Promise<MovimientoInventario[]> {
    const query = this.movimientoRepository
      .createQueryBuilder('movimiento')
      .leftJoinAndSelect('movimiento.articulo', 'articulo')
      .orderBy('movimiento.fecha_movimiento', 'DESC');

    if (filtros?.tipo && filtros.tipo !== 'todos' && filtros.tipo !== 'Todos') {
      query.andWhere('movimiento.tipo_movimiento = :tipo', {
        tipo: filtros.tipo.toLowerCase(),
      });
    }

    if (filtros?.busqueda && filtros.busqueda.trim() !== '') {
      const q = `%${filtros.busqueda.trim()}%`;
      query.andWhere(
        '(articulo.nombre LIKE :q OR movimiento.responsable_destino LIKE :q OR movimiento.motivo LIKE :q)',
        { q },
      );
    }

    return query.getMany();
  }

  async cambiarEstado(
    id: number,
    user: RequestUser,
    nuevoEstado?: 'activo' | 'inactivo',
  ): Promise<Articulo> {
    const articulo = await this.obtenerArticuloPorId(id);
    const { autor } = await this.resolverAutor(user);

    const estadoAnterior = articulo.estado;
    const siguienteEstado =
      nuevoEstado || (estadoAnterior === 'activo' ? 'inactivo' : 'activo');

    articulo.estado = siguienteEstado;
    const actualizado = await this.articuloRepository.save(articulo);

    await this.bitacoraService.registrarCambioEstado(
      ModuloBitacora.INVENTARIO,
      articulo.id,
      autor,
      estadoAnterior,
      siguienteEstado,
      `Artículo ${siguienteEstado === 'activo' ? 'reactivado' : 'inhabilitado'}`,
    );

    return actualizado;
  }

  // ------------------------------------------------------------------
  // PROVEEDORES
  // ------------------------------------------------------------------

  async listarProveedores(): Promise<Proveedor[]> {
    return this.proveedorRepository.find({
      order: { nombre: 'ASC' },
    });
  }

  async crearProveedor(dto: CrearProveedorDto): Promise<Proveedor> {
    const proveedor = this.proveedorRepository.create({
      nombre: dto.nombre,
      tipo: dto.tipo || 'Jurídico',
      contacto: dto.contacto || null,
      telefono: dto.telefono || null,
      correo: dto.correo || null,
      direccion: dto.direccion || null,
      estado: dto.estado || 'Activo',
    });
    return this.proveedorRepository.save(proveedor);
  }

  async actualizarProveedor(
    id: number,
    dto: ActualizarProveedorDto,
  ): Promise<Proveedor> {
    const proveedor = await this.proveedorRepository.findOne({ where: { id } });
    if (!proveedor) {
      throw new NotFoundException(`El proveedor con ID #${id} no existe`);
    }
    Object.assign(proveedor, dto);
    return this.proveedorRepository.save(proveedor);
  }

  async eliminarProveedor(id: number): Promise<{ message: string }> {
    const proveedor = await this.proveedorRepository.findOne({
      where: { id },
      relations: { articulos: true },
    });
    if (!proveedor) {
      throw new NotFoundException(`El proveedor con ID #${id} no existe`);
    }
    if (proveedor.articulos && proveedor.articulos.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar el proveedor porque tiene artículos vinculados en el inventario',
      );
    }
    await this.proveedorRepository.remove(proveedor);
    return { message: 'Proveedor eliminado correctamente' };
  }
}
