import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Solicitud } from '../../common/entities/solicitud.entity';
import { SolicitudCambioPropietario } from '../entities/solicitud-cambio-propietario.entity';
import { SolicitudDocumento } from '../../common/entities/solicitud-documento.entity';
import { Abonado } from '../../../abonados/entities/abonado.entity';
import { Empleado } from '../../../empleados/entities/empleado.entity';
import { User } from '../../../auth/entities/user.entity';
import { HistorialAbonado } from '../../../abonados/entities/historial-abonado.entity';
import { MailService } from '../../../auth/mail.service';
import { CloudinaryService } from '../../../../config/cloudinary.service';
import { BitacoraService } from '../../../bitacora/bitacora.service';
import { ModuloBitacora } from '../../../bitacora/entities/bitacora.enums';
import { CrearSolicitudCambioPropietarioDto } from '../dto/crear-solicitud-cambio-propietario.dto';
import { ActualizarEstadoSolicitudDto } from '../../common/dto/actualizar-estado-solicitud.dto';
import type { RequestUser } from '../../../auth/strategies/jwt.strategy';

export const TIPO_CAMBIO_PROPIETARIO = 'cambio_propietario';

const ESTADOS_ABIERTOS = ['pendiente', 'en_proceso'];
const ESTADOS_FINALES = ['aprobado', 'rechazado'];

export interface SolicitudCambioPropietarioResponse {
  id: number;
  codigo_solicitud: string;
  id_abonado: number;
  numero_abonado: string;
  nombre_abonado: string;
  cedula: string;
  correo: string;
  telefono: string;
  tipo_solicitud: string;
  estado: string;
  nombre_nuevo_propietario: string;
  cedula_nuevo_propietario: string;
  telefono_nuevo_propietario: string;
  correo_nuevo_propietario: string;
  motivo_traspaso: string;
  justificacion: string;
  documento_soporte_url: string | null;
  motivo_rechazo: string | null;
  id_empleado: number | null;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
}

@Injectable()
export class SolicitudesCambioPropietarioService {
  constructor(
    @InjectRepository(Solicitud)
    private readonly solicitudRepository: Repository<Solicitud>,
    @InjectRepository(SolicitudCambioPropietario)
    private readonly detalleRepository: Repository<SolicitudCambioPropietario>,
    @InjectRepository(SolicitudDocumento)
    private readonly documentoRepository: Repository<SolicitudDocumento>,
    @InjectRepository(Abonado)
    private readonly abonadoRepository: Repository<Abonado>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(HistorialAbonado)
    private readonly historialRepository: Repository<HistorialAbonado>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly bitacoraService: BitacoraService,
    private readonly mailService: MailService,
  ) {}

  private construirRespuesta(
    solicitud: Solicitud,
    detalle: SolicitudCambioPropietario,
  ): SolicitudCambioPropietarioResponse {
    return {
      id: solicitud.id,
      codigo_solicitud: solicitud.codigo_solicitud,
      id_abonado: solicitud.abonado?.id,
      numero_abonado: solicitud.abonado?.numero_abonado ?? '',
      nombre_abonado: solicitud.abonado?.nombre ?? '',
      cedula: solicitud.abonado?.cedula ?? '',
      correo: solicitud.abonado?.correo ?? '',
      telefono: solicitud.abonado?.telefono ?? '',
      tipo_solicitud: solicitud.tipo_solicitud,
      estado: solicitud.estado,
      nombre_nuevo_propietario: detalle.nombre_nuevo_propietario,
      cedula_nuevo_propietario: detalle.cedula_nuevo_propietario,
      telefono_nuevo_propietario: detalle.telefono_nuevo_propietario,
      correo_nuevo_propietario: detalle.correo_nuevo_propietario,
      motivo_traspaso: detalle.motivo_traspaso,
      justificacion: detalle.justificacion,
      documento_soporte_url: detalle.documento_soporte_url,
      motivo_rechazo: detalle.motivo_rechazo,
      id_empleado: solicitud.empleado?.id ?? null,
      fecha_creacion: solicitud.fecha_creacion,
      fecha_actualizacion: solicitud.fecha_actualizacion,
    };
  }

  private async cargarCompleta(
    id: number,
  ): Promise<SolicitudCambioPropietarioResponse> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id, tipo_solicitud: TIPO_CAMBIO_PROPIETARIO },
      relations: { abonado: true, empleado: true },
    });
    if (!solicitud) {
      throw new NotFoundException('La solicitud no fue encontrada');
    }
    const detalle = await this.detalleRepository.findOneBy({
      solicitud: { id: solicitud.id },
    });
    if (!detalle) {
      throw new NotFoundException(
        'La solicitud no tiene detalle de cambio de propietario',
      );
    }
    return this.construirRespuesta(solicitud, detalle);
  }

  private buscarAbonadoDeUsuario(usuarioId: number): Promise<Abonado | null> {
    return this.abonadoRepository.findOne({
      where: { usuario: { id: usuarioId } },
    });
  }

  private buscarEmpleadoDeUsuario(usuarioId: number): Promise<Empleado | null> {
    return this.empleadoRepository.findOne({
      where: { usuario: { id: usuarioId } },
    });
  }

  private async generarCodigoUnico(): Promise<string> {
    const anio = new Date().getFullYear();
    for (;;) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const codigo = `SOL-PRO-${anio}-${randomNum}`;
      const existente = await this.solicitudRepository.findOneBy({
        codigo_solicitud: codigo,
      });
      if (!existente) return codigo;
    }
  }

  private cedulasIguales(a: string, b: string): boolean {
    return a.replace(/\D/g, '') === b.replace(/\D/g, '');
  }

  async crear(
    dto: CrearSolicitudCambioPropietarioDto,
    file: Express.Multer.File,
    user: RequestUser,
  ): Promise<SolicitudCambioPropietarioResponse> {
    // 1. Antisuplantación y resolución de abonado
    let abonado: Abonado | null = null;
    if (user.role === 'abonado') {
      const abonadoVinculado = await this.buscarAbonadoDeUsuario(user.id);
      if (!abonadoVinculado) {
        throw new BadRequestException(
          'No hay un abonado vinculado a tu cuenta para hacer esta solicitud',
        );
      }
      // Si un abonado envía en el payload un idAbonado distinto, 403 Forbidden
      if (dto.idAbonado && Number(dto.idAbonado) !== abonadoVinculado.id) {
        throw new ForbiddenException(
          'No tienes permiso para solicitar un cambio de propietario en nombre de otro abonado',
        );
      }
      abonado = abonadoVinculado;
    } else {
      if (!dto.idAbonado) {
        throw new BadRequestException('Debes seleccionar un abonado');
      }
      abonado = await this.abonadoRepository.findOne({
        where: { id: dto.idAbonado },
      });
    }

    if (!abonado) {
      throw new NotFoundException('El abonado no fue encontrado');
    }
    if (abonado.estado !== 'Activo') {
      throw new BadRequestException(
        'El abonado está inactivo y no puede generar solicitudes',
      );
    }

    // 2. La cédula del nuevo propietario no puede ser igual a la del actual
    if (this.cedulasIguales(dto.cedulaNuevoPropietario, abonado.cedula)) {
      throw new BadRequestException(
        'La cédula del nuevo propietario debe ser distinta de la cédula del propietario actual',
      );
    }

    // 3. Evitar duplicados: máximo una solicitud abierta por abonado
    const duplicada = await this.solicitudRepository.findOne({
      where: {
        abonado: { id: abonado.id },
        tipo_solicitud: TIPO_CAMBIO_PROPIETARIO,
        estado: In(ESTADOS_ABIERTOS),
      },
    });
    if (duplicada) {
      throw new BadRequestException(
        `Ya existe una solicitud de cambio de propietario en curso (${duplicada.codigo_solicitud}). Espera a que se resuelva antes de crear otra.`,
      );
    }

    // 4. Subida a Cloudinary en solicitudes/cambio-propietario
    const esImagen = file.mimetype.startsWith('image/');
    const uploadResult = await this.cloudinaryService.subirArchivo(
      file,
      'solicitudes/cambio-propietario',
    );

    // 5. Vincular empleado si es rol administrativo
    const empleado =
      user.role === 'abonado'
        ? null
        : await this.buscarEmpleadoDeUsuario(user.id);

    // 6. Guardar cabecera de Solicitud
    const solicitud = this.solicitudRepository.create({
      codigo_solicitud: await this.generarCodigoUnico(),
      abonado,
      tipo_solicitud: TIPO_CAMBIO_PROPIETARIO,
      estado: 'pendiente',
      empleado,
    });

    let solicitudGuardada: Solicitud;
    try {
      solicitudGuardada = await this.solicitudRepository.save(solicitud);

      // 7. Guardar en tabla relacional solicitud_documentos
      const doc = this.documentoRepository.create({
        solicitud: solicitudGuardada,
        documento_url: uploadResult.url,
        documento_public_id: uploadResult.publicId,
        tipo_documento: 'documento_soporte',
        nombre_original: file.originalname,
      });
      await this.documentoRepository.save(doc);

      // 8. Guardar en detalle solicitud_cambio_propietario
      const detalle = this.detalleRepository.create({
        solicitud: solicitudGuardada,
        nombre_nuevo_propietario: dto.nombreNuevoPropietario.trim(),
        cedula_nuevo_propietario: dto.cedulaNuevoPropietario.trim(),
        telefono_nuevo_propietario: dto.telefonoNuevoPropietario.trim(),
        correo_nuevo_propietario: dto.correoNuevoPropietario.trim(),
        motivo_traspaso: dto.motivoTraspaso,
        justificacion: dto.justificacion.trim(),
        documento_soporte_url: uploadResult.url,
        documento_soporte_public_id: uploadResult.publicId,
        motivo_rechazo: null,
      });
      await this.detalleRepository.save(detalle);
    } catch (error) {
      // Rollback de Cloudinary en caso de fallo en BD
      await this.cloudinaryService.eliminarArchivo(
        uploadResult.publicId,
        esImagen,
      );
      throw error;
    }

    // 9. Registro obligatorio en Bitácora
    const usuarioAutor = await this.userRepository.findOneBy({ id: user.id });
    const autorEmail = (user as any).email ?? usuarioAutor?.email ?? null;

    await this.bitacoraService.registrarCreacion(
      ModuloBitacora.SOLICITUDES,
      solicitudGuardada.id,
      { id: user.id, email: autorEmail },
      'Solicitud de cambio de propietario creada',
    );

    return this.cargarCompleta(solicitudGuardada.id);
  }

  async listar(user: RequestUser): Promise<SolicitudCambioPropietarioResponse[]> {
    const donde: FindOptionsWhere<Solicitud> = {
      tipo_solicitud: TIPO_CAMBIO_PROPIETARIO,
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
      relations: { solicitud: true },
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
  ): Promise<SolicitudCambioPropietarioResponse> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id, tipo_solicitud: TIPO_CAMBIO_PROPIETARIO },
      relations: { abonado: true, empleado: true },
    });
    if (!solicitud) {
      throw new NotFoundException('La solicitud no fue encontrada');
    }
    const detalle = await this.detalleRepository.findOneBy({
      solicitud: { id: solicitud.id },
    });
    if (!detalle) {
      throw new NotFoundException(
        'La solicitud no tiene detalle de cambio de propietario',
      );
    }

    if (ESTADOS_FINALES.includes(solicitud.estado)) {
      throw new BadRequestException(
        'La solicitud ya está cerrada (aprobada o rechazada) y no admite más cambios',
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

    if (dto.estado === 'aprobado') {
      const usuario = await this.userRepository.findOneBy({ id: user.id });
      const email = usuario?.email ?? `usuario-${user.id}`;

      // Registrar en historial de movimientos del abonado
      const cambios = [
        {
          campo: 'propietario_nombre',
          valor_anterior: solicitud.abonado.nombre,
          valor_nuevo: detalle.nombre_nuevo_propietario,
        },
        {
          campo: 'propietario_cedula',
          valor_anterior: solicitud.abonado.cedula,
          valor_nuevo: detalle.cedula_nuevo_propietario,
        },
        {
          campo: 'propietario_telefono',
          valor_anterior: solicitud.abonado.telefono,
          valor_nuevo: detalle.telefono_nuevo_propietario,
        },
        {
          campo: 'propietario_correo',
          valor_anterior: solicitud.abonado.correo,
          valor_nuevo: detalle.correo_nuevo_propietario,
        },
      ];

      await this.historialRepository.save(
        cambios.map((c) =>
          this.historialRepository.create({
            abonado: { id: solicitud.abonado.id },
            usuario_email: email,
            campo: c.campo,
            valor_anterior: c.valor_anterior,
            valor_nuevo: c.valor_nuevo,
          }),
        ),
      );
    }

    const guardada = await this.solicitudRepository.save(solicitud);
    if (dto.estado === 'rechazado') {
      await this.detalleRepository.save(detalle);
    }

    // Auditoría obligatoria de cambio de estado en Bitácora
    const usuarioAutor = await this.userRepository.findOneBy({ id: user.id });
    const autorEmail = (user as any).email ?? usuarioAutor?.email ?? null;

    await this.bitacoraService.registrarCambioEstado(
      ModuloBitacora.SOLICITUDES,
      solicitud.id,
      { id: user.id, email: autorEmail },
      estadoAnterior,
      dto.estado,
      dto.motivoRechazo || 'Actualización de estado',
    );

    // Notificación por correo al abonado y al nuevo propietario
    if (dto.estado === 'aprobado' || dto.estado === 'rechazado') {
      try {
        await this.mailService.enviarCorreoResultadoCambioPropietario(
          solicitud.abonado.correo,
          detalle.correo_nuevo_propietario,
          {
            tipo: 'Cambio de Propietario (Cesión de Derechos)',
            codigo: solicitud.codigo_solicitud,
            estadoResultado: dto.estado as 'aprobado' | 'rechazado',
            motivo: detalle.motivo_rechazo ?? null,
            nombreNuevoPropietario: detalle.nombre_nuevo_propietario,
          },
        );
      } catch (error) {
        console.error(
          `No se pudo notificar por correo el resultado de la solicitud ${solicitud.codigo_solicitud}:`,
          error,
        );
      }
    }

    return this.cargarCompleta(guardada.id);
  }
}
