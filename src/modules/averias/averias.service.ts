import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { Averia } from './entities/averia.entity';
import { HistorialAveria } from './entities/historial-averia.entity';
import { CreateAveriaDto } from './dto/create-averia.dto';
import { UpdateAveriaDto } from './dto/update-averia.dto';
import { FiltroEstadisticasAveriasDto } from './dto/filtro-estadisticas-averias.dto';
import { Empleado } from '../empleados/entities/empleado.entity';
import { Abonado } from '../abonados/entities/abonado.entity';
import { User } from '../auth/entities/user.entity';
import { BitacoraService } from '../bitacora/bitacora.service';
import {
  ModuloBitacora,
  AccionBitacora,
} from '../bitacora/entities/bitacora.enums';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { formatearCedula } from '../../common/validacion/reglas-validacion';
import { SolicitudesMaterialService } from '../solicitudes-material/solicitudes-material.service';

export interface EstadisticasAveriasRespuesta {
  total: number;
  porTipo: { tipo: string; total: number }[];
  porEstado: { estado: string; total: number }[];
  registros: Averia[];
}

@Injectable()
export class AveriasService {
  constructor(
    @InjectRepository(Averia)
    private readonly averiaRepository: Repository<Averia>,
    @InjectRepository(HistorialAveria)
    private readonly historialRepository: Repository<HistorialAveria>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(Abonado)
    private readonly abonadoRepository: Repository<Abonado>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly bitacoraService: BitacoraService,
    private readonly solicitudesMaterialService: SolicitudesMaterialService,
  ) {}

  async create(dto: CreateAveriaDto): Promise<Averia> {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const codigoGenerado = `AVE-2026-${randomNum}`;
    const nuevaAveria = this.averiaRepository.create({
      codigo_averia: codigoGenerado,
      tipo_averia: dto.tipo_averia,
      descripcion: dto.descripcion,
      // Mismo formato que la cédula del abonado (X-XXXX-XXXX) para que la
      // avería aparezca en "Mis averías" aunque se escriba sin guiones.
      cedula_reportante:
        formatearCedula(dto.cedula_reportante) ?? dto.cedula_reportante,
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

  async misAverias(user: RequestUser): Promise<Averia[]> {
    const abonado = await this.abonadoRepository.findOne({
      where: { usuario: { id: user.id } },
    });
    if (!abonado) {
      throw new NotFoundException(
        'No se encontró un abonado vinculado a esta cuenta',
      );
    }

    const averias = await this.averiaRepository.find({
      where: { cedula_reportante: abonado.cedula },
      relations: { empleado: true },
      order: { fecha_reporte: 'DESC' },
    });

    for (const averia of averias) {
      (averia as unknown as Record<string, unknown>).historial =
        await this.armarHistorial(averia.id);
    }

    return averias;
  }

  // Averías asignadas al fontanero autenticado que siguen sin finalizarse.
  // Le sirven de "bandeja de pendientes" (perfil del fontanero) y de
  // opciones del formulario de reporte de actividad.
  async misAveriasFontanero(user: RequestUser): Promise<Averia[]> {
    const empleado = await this.empleadoRepository.findOne({
      where: { usuario: { id: user.id } },
    });
    if (!empleado) {
      throw new NotFoundException(
        'No se encontró un empleado vinculado a esta cuenta',
      );
    }

    const averias = await this.averiaRepository.find({
      // Solo las que siguen abiertas: las finalizadas ya se reportaron.
      where: {
        empleado: { id: empleado.id },
        estado: In(['Pendiente', 'En proceso']),
      },
      relations: { empleado: true },
      // Las más antiguas primero: son las que llevan más espera.
      order: { fecha_reporte: 'ASC', id: 'ASC' },
    });

    for (const averia of averias) {
      (averia as unknown as Record<string, unknown>).historial =
        await this.armarHistorial(averia.id);
    }

    // Las devueltas por revisión van primero (sort estable): son las que el
    // fontanero debe volver a atender, y así no se pierden entre las demás.
    return averias.sort(
      (a, b) => Number(b.devuelta_revision) - Number(a.devuelta_revision),
    );
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

  async actualizar(
    id: number,
    dto: UpdateAveriaDto,
    usuarioId?: number,
  ): Promise<Averia> {
    const averia = await this.findOne(id);
    // El autor del movimiento sale del token, no de lo que mande el cliente.
    const autor = { id: usuarioId ?? null, email: dto.realizado_por || 'Sistema' };

    if (dto.empleado_id) {
      const empleado = await this.empleadoRepository.findOneBy({
        id: dto.empleado_id,
      });
      if (!empleado) {
        throw new NotFoundException(
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
        autor,
        campo: 'empleado',
        valor_anterior: null,
        valor_nuevo: nombreEmp,
        observaciones: obsAsignacion,
      });
    }

    if (dto.estado) {
      // "En proceso" es un estado automático: lo pone el sistema cuando la
      // avería se asigna a un fontanero (o cuando el fontanero arranca la
      // gestión). No se puede fijar a mano.
      if (dto.estado === 'En proceso') {
        throw new BadRequestException(
          'El estado "En proceso" se asigna automáticamente al asignar un fontanero a la avería.',
        );
      }

      const estadosValidos = ['Pendiente', 'Finalizado'];
      if (!estadosValidos.includes(dto.estado)) {
        throw new BadRequestException(
          `Estado inválido. Valores permitidos: ${estadosValidos.join(', ')}`,
        );
      }

      // No se permite cambiar a "Finalizado" sin un fontanero asignado.
      if (dto.estado === 'Finalizado') {
        const tieneFontanero = dto.empleado_id || averia.empleado;
        if (!tieneFontanero) {
          throw new BadRequestException(
            'No se puede cambiar el estado a "Finalizado" sin antes asignar un fontanero a la avería.',
          );
        }
      }

      await this.bitacoraService.registrarCambioEstado(
        ModuloBitacora.AVERIAS,
        id,
        autor,
        averia.estado,
        dto.estado,
        dto.observacion || `Estado cambiado: ${averia.estado} → ${dto.estado}`,
      );
      averia.estado = dto.estado;
    }

    // Al asignar un fontanero, la avería pasa sola a "En proceso". El
    // fontanero la sigue viendo como "Pendiente" hasta que inicia la gestión
    // (eso lo resuelve el frontend con gestion_iniciada_en).
    if (
      dto.empleado_id &&
      averia.estado === 'Pendiente' &&
      !averia.gestion_iniciada_en
    ) {
      await this.bitacoraService.registrarCambioEstado(
        ModuloBitacora.AVERIAS,
        id,
        autor,
        'Pendiente',
        'En proceso',
        'Asignación de fontanero: la avería pasa a "En proceso" automáticamente.',
      );
      averia.estado = 'En proceso';
    }

    await this.averiaRepository.save(averia);
    return this.findOne(id);
  }

  // Resuelve el empleado del fontanero autenticado y comprueba que la avería
  // esté asignada a él: nadie puede iniciar ni finalizar la gestión de una
  // avería ajena aunque tenga el rol.
  private async averiaDelFontanero(
    id: number,
    user: RequestUser,
  ): Promise<Averia> {
    const empleado = await this.empleadoRepository.findOne({
      where: { usuario: { id: user.id } },
    });
    if (!empleado) {
      throw new NotFoundException(
        'No se encontró un empleado vinculado a esta cuenta',
      );
    }

    const averia = await this.findOne(id);
    if (averia.empleado?.id !== empleado.id) {
      throw new ForbiddenException(
        'Esta avería no está asignada a tu cuenta.',
      );
    }

    return averia;
  }

  private async autorDe(usuarioId: number) {
    const usuario = await this.userRepository.findOneBy({ id: usuarioId });
    return { id: usuarioId, email: usuario?.email ?? null };
  }

  // El fontanero empieza a atender una avería asignada: arranca el cronómetro
  // y la marca "En proceso". Si ya había iniciado antes, NO reinicia el
  // cronómetro (es idempotente).
  async iniciarGestion(id: number, user: RequestUser): Promise<Averia> {
    const averia = await this.averiaDelFontanero(id, user);

    if (averia.estado === 'Finalizado' || averia.estado === 'En revisión') {
      throw new BadRequestException(
        'Esta avería ya fue reportada o finalizada y no se puede volver a iniciar.',
      );
    }

    // Si el fontanero pidió materiales y la administración todavía no
    // respondió, no puede empezar: primero se aprueba (o rechaza) el pedido.
    if (await this.solicitudesMaterialService.tienePendiente(averia.id, null)) {
      throw new BadRequestException(
        'Tenés una solicitud de materiales pendiente de aprobación. Esperá la respuesta de la administración para iniciar.',
      );
    }

    const estadoAnterior = averia.estado;

    // La hora de inicio la pone el servidor: el cronómetro del frontend se
    // calcula contra ella, así que recargar la página no lo altera. Si la
    // gestión anterior ya se había terminado sin reportar, se reinicia.
    if (!averia.gestion_iniciada_en || averia.gestion_finalizada_en) {
      averia.gestion_iniciada_en = new Date();
      averia.gestion_finalizada_en = null;
    }
    // Al retomar la avería se limpia la marca de "devuelta por revisión".
    averia.devuelta_revision = false;
    averia.motivo_revision = null;
    averia.estado = 'En proceso';

    if (estadoAnterior !== 'En proceso') {
      const autor = await this.autorDe(user.id);
      await this.bitacoraService.registrarCambioEstado(
        ModuloBitacora.AVERIAS,
        id,
        autor,
        estadoAnterior,
        'En proceso',
        'El fontanero inició la gestión de la avería.',
      );
    }

    await this.averiaRepository.save(averia);
    return this.findOne(id);
  }

  // El fontanero termina de trabajar en la avería: detiene el cronómetro y
  // devuelve la duración real en minutos para prellenar el reporte. NO marca
  // la avería como finalizada: la resolución la aprueba o rechaza la
  // administración al revisar el reporte. El estado queda "En proceso" hasta
  // que se registre el reporte (pasa a "En revisión"). Idempotente.
  async terminarGestion(
    id: number,
    user: RequestUser,
  ): Promise<Averia & { duracion_minutos: number }> {
    const averia = await this.averiaDelFontanero(id, user);

    if (averia.estado === 'Finalizado' || averia.estado === 'En revisión') {
      throw new BadRequestException(
        'Esta avería ya fue reportada o finalizada.',
      );
    }

    if (!averia.gestion_finalizada_en) {
      averia.gestion_finalizada_en = new Date();
    }

    await this.averiaRepository.save(averia);

    const actualizada = await this.findOne(id);
    return Object.assign(actualizada, {
      duracion_minutos: this.calcularDuracionMinutos(
        actualizada.gestion_iniciada_en,
        actualizada.gestion_finalizada_en,
      ),
    });
  }

  // Duración en minutos entre dos marcas de tiempo, acotada a 1–1440 (el tope
  // de 24 h del reporte). Devuelve 0 si falta alguna marca.
  private calcularDuracionMinutos(
    inicio: Date | null,
    fin: Date | null,
  ): number {
    if (!inicio || !fin) return 0;
    const ms = fin.getTime() - inicio.getTime();
    if (ms <= 0) return 0;
    return Math.min(1440, Math.max(1, Math.round(ms / 60000)));
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

  async obtenerEstadisticas(
    filtros: FiltroEstadisticasAveriasDto,
  ): Promise<EstadisticasAveriasRespuesta> {
    if (filtros.fechaInicio?.trim() && filtros.fechaFin?.trim()) {
      if (filtros.fechaInicio > filtros.fechaFin) {
        throw new BadRequestException(
          'La fecha de inicio no puede ser posterior a la fecha de fin',
        );
      }
    }

    const qTotal = this.averiaRepository.createQueryBuilder('averia');
    this.aplicarFiltrosEstadisticas(qTotal, filtros);
    const total = await qTotal.getCount();

    if (total === 0) {
      return {
        total: 0,
        porTipo: [],
        porEstado: [],
        registros: [],
      };
    }

    const qTipo = this.averiaRepository
      .createQueryBuilder('averia')
      .select('averia.tipo_averia', 'tipo')
      .addSelect('COUNT(averia.id)', 'total');
    this.aplicarFiltrosEstadisticas(qTipo, filtros);
    const rawPorTipo = await qTipo
      .groupBy('averia.tipo_averia')
      .orderBy('total', 'DESC')
      .getRawMany();

    const qEstado = this.averiaRepository
      .createQueryBuilder('averia')
      .select('averia.estado', 'estado')
      .addSelect('COUNT(averia.id)', 'total');
    this.aplicarFiltrosEstadisticas(qEstado, filtros);
    const rawPorEstado = await qEstado
      .groupBy('averia.estado')
      .orderBy('total', 'DESC')
      .getRawMany();

    const qRegistros = this.averiaRepository
      .createQueryBuilder('averia')
      .leftJoinAndSelect('averia.empleado', 'empleado')
      .orderBy('averia.fecha_reporte', 'DESC');
    this.aplicarFiltrosEstadisticas(qRegistros, filtros);
    const registros = await qRegistros.getMany();

    return {
      total,
      porTipo: rawPorTipo.map((item) => ({
        tipo: item.tipo,
        total: Number(item.total) || 0,
      })),
      porEstado: rawPorEstado.map((item) => ({
        estado: item.estado,
        total: Number(item.total) || 0,
      })),
      registros,
    };
  }

  private aplicarFiltrosEstadisticas(
    query: SelectQueryBuilder<Averia>,
    filtros: FiltroEstadisticasAveriasDto,
  ) {
    if (filtros.fechaInicio?.trim()) {
      const inicio =
        filtros.fechaInicio.trim().length === 10
          ? `${filtros.fechaInicio.trim()} 00:00:00`
          : filtros.fechaInicio.trim();
      query.andWhere('averia.fecha_reporte >= :inicio', { inicio });
    }
    if (filtros.fechaFin?.trim()) {
      const fin =
        filtros.fechaFin.trim().length === 10
          ? `${filtros.fechaFin.trim()} 23:59:59`
          : filtros.fechaFin.trim();
      query.andWhere('averia.fecha_reporte <= :fin', { fin });
    }
    if (filtros.tipo?.trim() && filtros.tipo.trim() !== 'Todos') {
      query.andWhere('averia.tipo_averia = :tipo', {
        tipo: filtros.tipo.trim(),
      });
    }
    if (filtros.estado?.trim() && filtros.estado.trim() !== 'Todos') {
      query.andWhere('averia.estado = :estado', {
        estado: filtros.estado.trim(),
      });
    }
  }
}
