import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Solicitud } from './entities/solicitud.entity';
import { SolicitudCambioMedidor } from './entities/solicitud-cambio-medidor.entity';
import { Abonado } from '../abonados/entities/abonado.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { MailService } from '../auth/mail.service';
import { CloudinaryService } from '../../config/cloudinary.service';
import { CrearSolicitudCambioMedidorDto } from './dto/crear-solicitud-cambio-medidor.dto';
import { ActualizarEstadoSolicitudDto } from './dto/actualizar-estado-solicitud.dto';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

export const TIPO_CAMBIO_MEDIDOR = 'cambio_medidor';

const ESTADOS_ABIERTOS = ['pendiente', 'en_proceso'];
const ESTADOS_FINALES = ['aprobado', 'rechazado'];

export interface SolicitudCambioMedidorResponse {
  id: number;
  codigo_solicitud: string;
  id_abonado: number;
  numero_abonado: string;
  nombre_abonado: string;
  cedula: string;
  correo: string;
  tipo_solicitud: string;
  estado: string;
  motivo_falla: string;
  direccion_exacta: string;
  justificacion: string;
  evidencia_url: string | null;
  motivo_rechazo: string | null;
  id_empleado: number | null;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
}

@Injectable()
export class SolicitudesCambioMedidorService {
  constructor(
    @InjectRepository(Solicitud)
    private readonly solicitudRepository: Repository<Solicitud>,
    @InjectRepository(SolicitudCambioMedidor)
    private readonly detalleRepository: Repository<SolicitudCambioMedidor>,
    @InjectRepository(Abonado)
    private readonly abonadoRepository: Repository<Abonado>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly mailService: MailService,
  ) {}

  private construirRespuesta(
    solicitud: Solicitud,
    detalle: SolicitudCambioMedidor,
  ): SolicitudCambioMedidorResponse {
    return {
      id: solicitud.id,
      codigo_solicitud: solicitud.codigo_solicitud,
      id_abonado: solicitud.abonado?.id,
      numero_abonado: solicitud.abonado?.numero_abonado ?? '',
      nombre_abonado: solicitud.abonado?.nombre ?? '',
      cedula: solicitud.abonado?.cedula ?? '',
      correo: solicitud.abonado?.correo ?? '',
      tipo_solicitud: solicitud.tipo_solicitud,
      estado: solicitud.estado,
      motivo_falla: detalle.motivo_falla,
      direccion_exacta: detalle.direccion_exacta,
      justificacion: detalle.justificacion,
      evidencia_url: detalle.evidencia_url,
      motivo_rechazo: detalle.motivo_rechazo,
      id_empleado: solicitud.empleado?.id ?? null,
      fecha_creacion: solicitud.fecha_creacion,
      fecha_actualizacion: solicitud.fecha_actualizacion,
    };
  }

  private async cargarCompleta(
    id: number,
  ): Promise<SolicitudCambioMedidorResponse> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id, tipo_solicitud: TIPO_CAMBIO_MEDIDOR },
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
        'La solicitud no tiene detalle de cambio de medidor',
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
      const codigo = `SOL-MED-${anio}-${randomNum}`;
      const existente = await this.solicitudRepository.findOneBy({
        codigo_solicitud: codigo,
      });
      if (!existente) return codigo;
    }
  }

  async crear(
    dto: CrearSolicitudCambioMedidorDto,
    file: Express.Multer.File,
    user: RequestUser,
  ): Promise<SolicitudCambioMedidorResponse> {
    // 1. Resolver abonado (inmutable para rol Abonado, seleccionable para Admin)
    let abonado: Abonado | null = null;
    if (user.role === 'abonado') {
      abonado = await this.buscarAbonadoDeUsuario(user.id);
      if (!abonado) {
        throw new BadRequestException(
          'No hay un abonado vinculado a tu cuenta para hacer esta solicitud',
        );
      }
    } else {
      if (!dto.idAbonado) {
        throw new BadRequestException('Debes seleccionar un abonado');
      }
      abonado = await this.abonadoRepository.findOneBy({ id: dto.idAbonado });
    }

    if (!abonado) {
      throw new NotFoundException('El abonado no fue encontrado');
    }
    if (abonado.estado !== 'Activo') {
      throw new BadRequestException(
        'El abonado está inactivo y no puede generar solicitudes',
      );
    }

    // 2. Control de solicitudes duplicadas en curso
    const duplicada = await this.solicitudRepository.findOne({
      where: {
        abonado: { id: abonado.id },
        tipo_solicitud: TIPO_CAMBIO_MEDIDOR,
        estado: In(ESTADOS_ABIERTOS),
      },
    });
    if (duplicada) {
      throw new BadRequestException(
        `Ya existe una solicitud de cambio de medidor en curso (${duplicada.codigo_solicitud}). Espera a que se resuelva.`,
      );
    }

    // 3. Subir la fotografía a Cloudinary
    const uploadResult = await this.cloudinaryService.subirArchivo(
      file,
      'solicitudes/cambio-medidor',
    );

    // 4. Asignar empleado si es gestión en ventanilla
    const empleado =
      user.role === 'abonado'
        ? null
        : await this.buscarEmpleadoDeUsuario(user.id);

    // 5. Guardar la cabecera en `solicitudes`
    const solicitud = this.solicitudRepository.create({
      codigo_solicitud: await this.generarCodigoUnico(),
      abonado,
      tipo_solicitud: TIPO_CAMBIO_MEDIDOR,
      estado: 'pendiente',
      empleado,
    });
    const guardada = await this.solicitudRepository.save(solicitud);

    // 6. Guardar el detalle técnico con la URL de Cloudinary
    const detalle = this.detalleRepository.create({
      solicitud: guardada,
      motivo_falla: dto.motivoFalla,
      direccion_exacta: dto.direccionExacta.trim(),
      justificacion: dto.justificacion.trim(),
      evidencia_url: uploadResult.url,
      evidencia_public_id: uploadResult.publicId,
      motivo_rechazo: null,
    });
    await this.detalleRepository.save(detalle);

    return this.cargarCompleta(guardada.id);
  }

  async listar(user: RequestUser): Promise<SolicitudCambioMedidorResponse[]> {
    const donde: FindOptionsWhere<Solicitud> = {
      tipo_solicitud: TIPO_CAMBIO_MEDIDOR,
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
  ): Promise<SolicitudCambioMedidorResponse> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id, tipo_solicitud: TIPO_CAMBIO_MEDIDOR },
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
        'La solicitud no tiene detalle de cambio de medidor',
      );
    }

    if (ESTADOS_FINALES.includes(solicitud.estado)) {
      throw new BadRequestException(
        'La solicitud ya está cerrada y no admite más cambios',
      );
    }

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

    // Notificación por correo electrónico
    if (dto.estado === 'aprobado' || dto.estado === 'rechazado') {
      try {
        await this.mailService.enviarCorreoResultadoSolicitud(
          solicitud.abonado.correo,
          {
            tipo: 'Cambio o reparación de medidor',
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
