import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Solicitud } from '../../common/entities/solicitud.entity';
import {
  AdjuntoConexion,
  SolicitudConexionPajaAgua,
} from '../entities/solicitud-conexion-paja-agua.entity';
import { SolicitudPajaAgua } from '../../paja-agua/entities/solicitud-paja-agua.entity';
import { Abonado } from '../../../abonados/entities/abonado.entity';
import { Empleado } from '../../../empleados/entities/empleado.entity';
import { User } from '../../../auth/entities/user.entity';
import { CrearSolicitudConexionDto } from '../dto/crear-solicitud-conexion.dto';
import { ActualizarEstadoSolicitudDto } from '../../common/dto/actualizar-estado-solicitud.dto';
import { CloudinaryService } from '../../../../config/cloudinary.service';
import { MailService } from '../../../auth/mail.service';
import { BitacoraService } from '../../../bitacora/bitacora.service';
import { ModuloBitacora } from '../../../bitacora/entities/bitacora.enums';
import type { RequestUser } from '../../../auth/strategies/jwt.strategy';

export const TIPO_CONEXION_PAJA_AGUA = 'conexion_paja_agua';
const CARPETA_CLOUDINARY = 'ASADA/solicitudes/conexion-paja-agua';
const ESTADOS_FINALES = ['aprobado', 'rechazado'];

export interface SolicitudConexionDisponible {
  id: number;
  codigo_solicitud: string;
  nombre_solicitante: string;
  identificacion: string;
  tipo_persona: string;
  telefono: string;
  correo: string;
  provincia: string | null;
  canton: string | null;
  distrito: string | null;
  direccion: string;
  naturaleza_inmueble: string | null;
  calidad_titular: string | null;
  tipo_servicio: string | null;
  tipo_conexion: string | null;
}

export interface SolicitudConexionResponse {
  id: number;
  codigo_solicitud: string;
  id_abonado: number;
  numero_abonado: string;
  nombre_abonado: string;
  cedula: string;
  correo: string;
  estado: string;
  solicitud_paja_agua_codigo: string;
  medio_notificacion_principal: string;
  valor_notificacion_principal: string;
  medio_notificacion_secundario: string | null;
  valor_notificacion_secundario: string | null;
  folio_real: string | null;
  plano_catastro: string | null;
  plano_agrimensura: string | null;
  numero_disponibilidad: string;
  numero_nis: string | null;
  servicio_solicitado: string;
  tipo_tramite: string;
  codigo_apc_cfia: string | null;
  forma_pago: string;
  nombre_firmante: string;
  identificacion_firmante: string;
  firma_path: string;
  adjuntos: AdjuntoConexion[];
  motivo_rechazo: string | null;
  id_empleado: number | null;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
}

@Injectable()
export class SolicitudesConexionService {
  constructor(
    @InjectRepository(Solicitud)
    private readonly solicitudRepository: Repository<Solicitud>,
    @InjectRepository(SolicitudConexionPajaAgua)
    private readonly detalleRepository: Repository<SolicitudConexionPajaAgua>,
    @InjectRepository(SolicitudPajaAgua)
    private readonly pajaAguaRepository: Repository<SolicitudPajaAgua>,
    @InjectRepository(Abonado)
    private readonly abonadoRepository: Repository<Abonado>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly mailService: MailService,
    private readonly bitacoraService: BitacoraService,
  ) {}

  private buscarAbonadoDeUsuario(usuarioId: number): Promise<Abonado | null> {
    return this.abonadoRepository.findOne({
      where: { usuario: { id: usuarioId } },
    });
  }

  private buscarEmpleadoDeUsuario(
    usuarioId: number,
  ): Promise<Empleado | null> {
    return this.empleadoRepository.findOne({
      where: { usuario: { id: usuarioId } },
    });
  }

  private async correoDeUsuario(usuarioId: number): Promise<string | null> {
    const usuario = await this.userRepository.findOneBy({ id: usuarioId });
    return usuario?.email ?? null;
  }

  private async generarCodigoUnico(): Promise<string> {
    const anio = new Date().getFullYear();
    for (;;) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const codigo = `SOL-CONEX-${anio}-${randomNum}`;
      const existente = await this.solicitudRepository.findOneBy({
        codigo_solicitud: codigo,
      });
      if (!existente) return codigo;
    }
  }

  private construirRespuesta(
    solicitud: Solicitud,
    detalle: SolicitudConexionPajaAgua,
  ): SolicitudConexionResponse {
    return {
      id: solicitud.id,
      codigo_solicitud: solicitud.codigo_solicitud,
      id_abonado: solicitud.abonado?.id,
      numero_abonado: solicitud.abonado?.numero_abonado ?? '',
      nombre_abonado: solicitud.abonado?.nombre ?? '',
      cedula: solicitud.abonado?.cedula ?? '',
      correo: solicitud.abonado?.correo ?? '',
      estado: solicitud.estado,
      solicitud_paja_agua_codigo:
        detalle.solicitudPajaAgua?.codigo_solicitud ?? '',
      medio_notificacion_principal: detalle.medio_notificacion_principal,
      valor_notificacion_principal: detalle.valor_notificacion_principal,
      medio_notificacion_secundario: detalle.medio_notificacion_secundario,
      valor_notificacion_secundario: detalle.valor_notificacion_secundario,
      folio_real: detalle.folio_real,
      plano_catastro: detalle.plano_catastro,
      plano_agrimensura: detalle.plano_agrimensura,
      numero_disponibilidad: detalle.numero_disponibilidad,
      numero_nis: detalle.numero_nis,
      servicio_solicitado: detalle.servicio_solicitado,
      tipo_tramite: detalle.tipo_tramite,
      codigo_apc_cfia: detalle.codigo_apc_cfia,
      forma_pago: detalle.forma_pago,
      nombre_firmante: detalle.nombre_firmante,
      identificacion_firmante: detalle.identificacion_firmante,
      firma_path: detalle.firma_path,
      adjuntos: detalle.adjuntos ?? [],
      motivo_rechazo: detalle.motivo_rechazo,
      id_empleado: solicitud.empleado?.id ?? null,
      fecha_creacion: solicitud.fecha_creacion,
      fecha_actualizacion: solicitud.fecha_actualizacion,
    };
  }

  private async cargarCompleta(id: number): Promise<SolicitudConexionResponse> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id, tipo_solicitud: TIPO_CONEXION_PAJA_AGUA },
      relations: { abonado: true, empleado: true },
    });
    if (!solicitud) {
      throw new NotFoundException('La solicitud no fue encontrada');
    }
    const detalle = await this.detalleRepository.findOne({
      where: { solicitud: { id: solicitud.id } },
      relations: { solicitudPajaAgua: true },
    });
    if (!detalle) {
      throw new NotFoundException(
        'La solicitud no tiene detalle de conexión de servicio',
      );
    }
    return this.construirRespuesta(solicitud, detalle);
  }

  // Solicitudes de paja de agua ya Aprobadas de este abonado que TODAVÍA no
  // tienen una solicitud de conexión — son las que puede usar para iniciar
  // este trámite. Se usa tanto para decidir si mostrar la página en el
  // dashboard como para precargar sus datos en el formulario.
  async solicitudesDisponibles(
    user: RequestUser,
  ): Promise<SolicitudConexionDisponible[]> {
    const abonado = await this.buscarAbonadoDeUsuario(user.id);
    if (!abonado) return [];

    const aprobadas = await this.pajaAguaRepository.find({
      where: { abonado: { id: abonado.id }, estado: 'Aprobada' },
      order: { fecha_solicitud: 'DESC' },
    });
    if (aprobadas.length === 0) return [];

    const yaConConexion = await this.detalleRepository.find({
      where: { solicitudPajaAgua: { id: In(aprobadas.map((s) => s.id)) } },
      relations: { solicitudPajaAgua: true },
    });
    const idsConConexion = new Set(
      yaConConexion.map((d) => d.solicitudPajaAgua.id),
    );

    return aprobadas
      .filter((s) => !idsConConexion.has(s.id))
      .map((s) => ({
        id: s.id,
        codigo_solicitud: s.codigo_solicitud,
        nombre_solicitante: s.nombre_solicitante,
        identificacion: s.identificacion,
        tipo_persona: s.tipo_persona,
        telefono: s.telefono,
        correo: s.correo,
        provincia: s.provincia,
        canton: s.canton,
        distrito: s.distrito,
        direccion: s.direccion,
        naturaleza_inmueble: s.naturaleza_inmueble,
        calidad_titular: s.calidad_titular,
        tipo_servicio: s.tipo_servicio,
        tipo_conexion: s.tipo_conexion,
      }));
  }

  async crear(
    dto: CrearSolicitudConexionDto,
    files: {
      firma?: Express.Multer.File[];
      adjuntos?: Express.Multer.File[];
    },
    user: RequestUser,
  ): Promise<SolicitudConexionResponse> {
    const abonado = await this.buscarAbonadoDeUsuario(user.id);
    if (!abonado) {
      throw new BadRequestException(
        'No hay un abonado vinculado a tu cuenta para hacer esta solicitud',
      );
    }

    const disponibles = await this.solicitudesDisponibles(user);
    if (disponibles.length === 0) {
      throw new BadRequestException(
        'No tienes ninguna solicitud de paja de agua aprobada disponible para iniciar este trámite',
      );
    }

    let solicitudPajaAguaId = dto.idSolicitudPajaAgua;
    if (!solicitudPajaAguaId) {
      if (disponibles.length > 1) {
        throw new BadRequestException(
          'Tienes más de una solicitud de paja de agua aprobada: indica a cuál corresponde este trámite',
        );
      }
      solicitudPajaAguaId = disponibles[0].id;
    }
    if (!disponibles.some((d) => d.id === solicitudPajaAguaId)) {
      throw new BadRequestException(
        'Esa solicitud de paja de agua no está disponible para iniciar este trámite',
      );
    }

    const solicitudPajaAgua = await this.pajaAguaRepository.findOneByOrFail({
      id: solicitudPajaAguaId,
    });

    if (!files?.firma?.[0]) {
      throw new BadRequestException('Debes adjuntar tu firma');
    }
    if (!files?.adjuntos || files.adjuntos.length === 0) {
      throw new BadRequestException('Debes adjuntar al menos un documento');
    }

    let metaAdjuntos: { tipo: string; etiqueta: string }[] = [];
    if (dto.adjuntosMeta) {
      try {
        metaAdjuntos = JSON.parse(dto.adjuntosMeta);
      } catch {
        throw new BadRequestException(
          'El detalle de los adjuntos (adjuntosMeta) no es un JSON válido',
        );
      }
    }

    const firmaSubida = await this.cloudinaryService.subirArchivo(
      files.firma[0],
      CARPETA_CLOUDINARY,
    );

    const adjuntosSubidos: AdjuntoConexion[] = [];
    try {
      for (let i = 0; i < files.adjuntos.length; i++) {
        const meta = metaAdjuntos[i] ?? { tipo: 'otro', etiqueta: 'Documento' };
        const subido = await this.cloudinaryService.subirArchivo(
          files.adjuntos[i],
          CARPETA_CLOUDINARY,
        );
        adjuntosSubidos.push({
          tipo: meta.tipo,
          etiqueta: meta.etiqueta,
          url: subido.url,
          publicId: subido.publicId,
        });
      }
    } catch (error) {
      await this.cloudinaryService.eliminarArchivo(firmaSubida.publicId, false);
      for (const adjunto of adjuntosSubidos) {
        await this.cloudinaryService.eliminarArchivo(adjunto.publicId, false);
      }
      throw error;
    }

    try {
      const solicitud = this.solicitudRepository.create({
        codigo_solicitud: await this.generarCodigoUnico(),
        abonado,
        tipo_solicitud: TIPO_CONEXION_PAJA_AGUA,
        estado: 'pendiente',
        empleado: null,
      });
      const guardada = await this.solicitudRepository.save(solicitud);

      const detalle = this.detalleRepository.create({
        solicitud: guardada,
        solicitudPajaAgua,
        medio_notificacion_principal: dto.medioNotificacionPrincipal,
        valor_notificacion_principal: dto.valorNotificacionPrincipal,
        medio_notificacion_secundario: dto.medioNotificacionSecundario ?? null,
        valor_notificacion_secundario: dto.valorNotificacionSecundario ?? null,
        folio_real: dto.folioReal ?? null,
        plano_catastro: dto.planoCatastro ?? null,
        plano_agrimensura: dto.planoAgrimensura ?? null,
        numero_disponibilidad: dto.numeroDisponibilidad,
        numero_nis: dto.numeroNis ?? null,
        servicio_solicitado: dto.servicioSolicitado,
        tipo_tramite: dto.tipoTramite,
        codigo_apc_cfia: dto.codigoApcCfia ?? null,
        forma_pago: dto.formaPago,
        nombre_firmante: dto.nombreFirmante,
        identificacion_firmante: dto.identificacionFirmante,
        firma_path: firmaSubida.url,
        firma_public_id: firmaSubida.publicId,
        adjuntos: adjuntosSubidos,
        motivo_rechazo: null,
      });
      await this.detalleRepository.save(detalle);

      await this.bitacoraService.registrarCreacion(
        ModuloBitacora.SOLICITUDES,
        guardada.id,
        { id: user.id, email: await this.correoDeUsuario(user.id) },
        `Solicitud de conexión de servicio ${guardada.codigo_solicitud} creada`,
      );

      return this.cargarCompleta(guardada.id);
    } catch (error) {
      await this.cloudinaryService.eliminarArchivo(firmaSubida.publicId, false);
      for (const adjunto of adjuntosSubidos) {
        await this.cloudinaryService.eliminarArchivo(adjunto.publicId, false);
      }
      throw error;
    }
  }

  async listar(user: RequestUser): Promise<SolicitudConexionResponse[]> {
    const donde: FindOptionsWhere<Solicitud> = {
      tipo_solicitud: TIPO_CONEXION_PAJA_AGUA,
    };
    if (user.role === 'abonado') {
      const abonado = await this.buscarAbonadoDeUsuario(user.id);
      if (!abonado) return [];
      donde.abonado = { id: abonado.id };
    }

    const solicitudes = await this.solicitudRepository.find({
      where: donde,
      relations: { abonado: true, empleado: true },
      order: { fecha_creacion: 'DESC' },
    });
    if (solicitudes.length === 0) return [];

    const ids = solicitudes.map((s) => s.id);
    const detalles = await this.detalleRepository.find({
      where: { solicitud: { id: In(ids) } },
      relations: { solicitud: true, solicitudPajaAgua: true },
    });
    const detallePorSolicitud = new Map(
      detalles.map((d) => [d.solicitud.id, d]),
    );

    return solicitudes
      .filter((s) => detallePorSolicitud.has(s.id))
      .map((s) => this.construirRespuesta(s, detallePorSolicitud.get(s.id)!));
  }

  async cambiarEstado(
    id: number,
    dto: ActualizarEstadoSolicitudDto,
    user: RequestUser,
  ): Promise<SolicitudConexionResponse> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id, tipo_solicitud: TIPO_CONEXION_PAJA_AGUA },
      relations: { abonado: true, empleado: true },
    });
    if (!solicitud) {
      throw new NotFoundException('La solicitud no fue encontrada');
    }
    const detalle = await this.detalleRepository.findOne({
      where: { solicitud: { id: solicitud.id } },
      relations: { solicitudPajaAgua: true },
    });
    if (!detalle) {
      throw new NotFoundException(
        'La solicitud no tiene detalle de conexión de servicio',
      );
    }
    if (ESTADOS_FINALES.includes(solicitud.estado)) {
      throw new BadRequestException(
        'La solicitud ya está cerrada y no admite más cambios',
      );
    }

    const estadoAnterior = solicitud.estado;

    const empleado = await this.buscarEmpleadoDeUsuario(user.id);
    if (empleado) {
      solicitud.empleado = empleado;
    }

    solicitud.estado = dto.estado;
    if (dto.estado === 'rechazado') {
      detalle.motivo_rechazo = dto.motivoRechazo?.trim() || null;
    }

    const guardada = await this.solicitudRepository.save(solicitud);
    if (dto.estado === 'rechazado') {
      await this.detalleRepository.save(detalle);
    }

    await this.bitacoraService.registrarCambioEstado(
      ModuloBitacora.SOLICITUDES,
      solicitud.id,
      { id: user.id, email: await this.correoDeUsuario(user.id) },
      estadoAnterior,
      dto.estado,
      dto.motivoRechazo?.trim() || 'Actualización de estado',
    );

    if (dto.estado === 'aprobado' || dto.estado === 'rechazado') {
      try {
        await this.mailService.enviarCorreoResultadoSolicitud(
          solicitud.abonado.correo,
          {
            tipo: 'Solicitud de conexión de servicio',
            codigo: solicitud.codigo_solicitud,
            estadoResultado: dto.estado as 'aprobado' | 'rechazado',
            motivo: detalle.motivo_rechazo ?? null,
          },
        );
      } catch (error) {
        console.error(
          `Error al notificar por correo solicitud ${solicitud.codigo_solicitud}:`,
          error,
        );
      }
    }

    return this.cargarCompleta(guardada.id);
  }
}
