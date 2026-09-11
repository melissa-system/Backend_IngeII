import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Solicitud } from './entities/solicitud.entity';
import { SolicitudOtro } from './entities/solicitud-otro.entity';
import { Abonado } from '../abonados/entities/abonado.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { MailService } from '../auth/mail.service';
import { CloudinaryService } from '../../config/cloudinary.service';
import { CrearSolicitudOtroDto } from './dto/crear-solicitud-otro.dto';
import { ActualizarEstadoSolicitudOtroDto } from './dto/actualizar-estado-solicitud-otro.dto';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

export const TIPO_OTRO = 'otro';

const ESTADOS_ABIERTOS = ['pendiente', 'en_proceso'];
const ESTADOS_FINALES = ['aprobado', 'rechazado'];

// Forma "plana" que consume el frontend: junta la fila de solicitudes con el
// detalle de "otro" y los datos del abonado en un solo objeto.
export interface SolicitudOtroResponse {
  id: number;
  codigo_solicitud: string;
  id_abonado: number;
  numero_abonado: string;
  nombre_abonado: string;
  cedula: string;
  correo: string;
  tipo_solicitud: string;
  estado: string;
  asunto: string;
  justificacion: string;
  adjunto_url: string | null;
  motivo_rechazo: string | null;
  id_empleado: number | null;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
}

@Injectable()
export class SolicitudesOtroService {
  constructor(
    @InjectRepository(Solicitud)
    private readonly solicitudRepository: Repository<Solicitud>,
    @InjectRepository(SolicitudOtro)
    private readonly detalleRepository: Repository<SolicitudOtro>,
    @InjectRepository(Abonado)
    private readonly abonadoRepository: Repository<Abonado>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly mailService: MailService,
  ) {}

  private construirRespuesta(
    solicitud: Solicitud,
    detalle: SolicitudOtro,
  ): SolicitudOtroResponse {
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
      asunto: detalle.asunto,
      justificacion: detalle.justificacion,
      adjunto_url: detalle.adjunto_url,
      motivo_rechazo: detalle.motivo_rechazo,
      id_empleado: solicitud.empleado?.id ?? null,
      fecha_creacion: solicitud.fecha_creacion,
      fecha_actualizacion: solicitud.fecha_actualizacion,
    };
  }

  private async cargarCompleta(
    id: number,
  ): Promise<SolicitudOtroResponse> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id, tipo_solicitud: TIPO_OTRO },
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
        'La solicitud no tiene detalle de trámite "otro"',
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
      const codigo = `SOL-OTRO-${anio}-${randomNum}`;
      const existente = await this.solicitudRepository.findOneBy({
        codigo_solicitud: codigo,
      });
      if (!existente) return codigo;
    }
  }

  async crear(
    dto: CrearSolicitudOtroDto,
    file: Express.Multer.File,
    user: RequestUser,
  ): Promise<SolicitudOtroResponse> {
    // 1. Resolver el abonado: un abonado logueado usa su propio registro; un
    //    administrador elige el abonado para quien se crea la solicitud.
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

    // 2. Evitar duplicados: máximo una solicitud "otro" abierta (pendiente o
    //    en proceso) por abonado.
    const duplicada = await this.solicitudRepository.findOne({
      where: {
        abonado: { id: abonado.id },
        tipo_solicitud: TIPO_OTRO,
        estado: In(ESTADOS_ABIERTOS),
      },
    });
    if (duplicada) {
      throw new BadRequestException(
        `Ya existe una solicitud en curso (${duplicada.codigo_solicitud}). Espera a que se resuelva antes de crear otra.`,
      );
    }

    // 3. Archivo de soporte opcional: solo se sube a Cloudinary si llegó uno.
    const adjunto = file
      ? await this.cloudinaryService.subirArchivo(file, 'solicitudes/otro')
      : null;

    // 4. Quien crea siendo empleado queda asociado a la solicitud.
    const empleado =
      user.role === 'abonado'
        ? null
        : await this.buscarEmpleadoDeUsuario(user.id);

    const solicitud = this.solicitudRepository.create({
      codigo_solicitud: await this.generarCodigoUnico(),
      abonado,
      tipo_solicitud: TIPO_OTRO,
      estado: 'pendiente',
      empleado,
    });
    const guardada = await this.solicitudRepository.save(solicitud);

    const detalle = this.detalleRepository.create({
      solicitud: guardada,
      asunto: dto.asunto.trim(),
      justificacion: dto.justificacion.trim(),
      adjunto_url: adjunto?.url ?? null,
      adjunto_public_id: adjunto?.publicId ?? null,
      motivo_rechazo: null,
    });
    await this.detalleRepository.save(detalle);

    return this.cargarCompleta(guardada.id);
  }

  async listar(user: RequestUser): Promise<SolicitudOtroResponse[]> {
    // Un abonado solo ve sus propias solicitudes; un administrador las ve todas.
    const donde: FindOptionsWhere<Solicitud> = {
      tipo_solicitud: TIPO_OTRO,
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
    dto: ActualizarEstadoSolicitudOtroDto,
    user: RequestUser,
  ): Promise<SolicitudOtroResponse> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id, tipo_solicitud: TIPO_OTRO },
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
        'La solicitud no tiene detalle de trámite "otro"',
      );
    }

    if (ESTADOS_FINALES.includes(solicitud.estado)) {
      throw new BadRequestException(
        'La solicitud ya está cerrada (aprobada o rechazada) y no admite más cambios',
      );
    }

    // Quien gestiona, sea quien la creó o quién la resuelve, queda asociado.
    const empleado = await this.buscarEmpleadoDeUsuario(user.id);
    if (empleado) {
      solicitud.empleado = empleado;
    }

    solicitud.estado = dto.estado;

    // Al aprobar o rechazar el comentario del administrador es obligatorio:
    // queda documentada la resolución en motivo_rechazo. Este tipo NO actualiza
    // nada del abonado, solo se registra la nota y se notifica por correo.
    if (dto.estado === 'aprobado' || dto.estado === 'rechazado') {
      detalle.motivo_rechazo = dto.motivoRechazo?.trim() || null;
    }

    const guardada = await this.solicitudRepository.save(solicitud);
    if (dto.estado === 'aprobado' || dto.estado === 'rechazado') {
      await this.detalleRepository.save(detalle);
    }

    // Notificar por correo al abonado el resultado y el comentario del
    // administrador. Aislado en try/catch: el estado ya se guardó, un fallo
    // de SMTP no debe tumbar la respuesta.
    if (dto.estado === 'aprobado' || dto.estado === 'rechazado') {
      try {
        await this.mailService.enviarCorreoResultadoOtro(
          solicitud.abonado.correo,
          {
            codigo: solicitud.codigo_solicitud,
            estadoResultado: dto.estado as 'aprobado' | 'rechazado',
            asunto: detalle.asunto,
            comentario: detalle.motivo_rechazo ?? null,
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