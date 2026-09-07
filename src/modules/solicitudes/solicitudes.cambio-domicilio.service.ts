import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Solicitud } from './entities/solicitud.entity';
import { SolicitudCambioDomicilio } from './entities/solicitud-cambio-domicilio.entity';
import { Abonado } from '../abonados/entities/abonado.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { User } from '../auth/entities/user.entity';
import { HistorialAbonado } from '../abonados/entities/historial-abonado.entity';
import { MailService } from '../auth/mail.service';
import { CrearSolicitudCambioDomicilioDto } from './dto/crear-solicitud-cambio-domicilio.dto';
import { ActualizarEstadoSolicitudDto } from './dto/actualizar-estado-solicitud.dto';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

export const TIPO_CAMBIO_DOMICILIO = 'cambio_domicilio';

const ESTADOS_ABIERTOS = ['pendiente', 'en_proceso'];
const ESTADOS_FINALES = ['aprobado', 'rechazado'];

// Forma "plana" que consume el frontend: junta la fila de solicitudes con el
// detalle de cambio de domicilio y los datos del abonado en un solo objeto.
export interface SolicitudCambioDomicilioResponse {
  id: number;
  codigo_solicitud: string;
  id_abonado: number;
  numero_abonado: string;
  nombre_abonado: string;
  cedula: string;
  correo: string;
  tipo_solicitud: string;
  estado: string;
  direccion_anterior: string;
  direccion_nueva: string;
  justificacion: string;
  motivo_rechazo: string | null;
  id_empleado: number | null;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
}

@Injectable()
export class CambioDomicilioService {
  constructor(
    @InjectRepository(Solicitud)
    private readonly solicitudRepository: Repository<Solicitud>,
    @InjectRepository(SolicitudCambioDomicilio)
    private readonly detalleRepository: Repository<SolicitudCambioDomicilio>,
    @InjectRepository(Abonado)
    private readonly abonadoRepository: Repository<Abonado>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(HistorialAbonado)
    private readonly historialRepository: Repository<HistorialAbonado>,
    private readonly mailService: MailService,
  ) {}

  private construirRespuesta(
    solicitud: Solicitud,
    detalle: SolicitudCambioDomicilio,
  ): SolicitudCambioDomicilioResponse {
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
      direccion_anterior: detalle.direccion_anterior,
      direccion_nueva: detalle.direccion_nueva,
      justificacion: detalle.justificacion,
      motivo_rechazo: detalle.motivo_rechazo,
      id_empleado: solicitud.empleado?.id ?? null,
      fecha_creacion: solicitud.fecha_creacion,
      fecha_actualizacion: solicitud.fecha_actualizacion,
    };
  }

  private async cargarCompleta(
    id: number,
    tipo: string = TIPO_CAMBIO_DOMICILIO,
  ): Promise<SolicitudCambioDomicilioResponse> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id, tipo_solicitud: tipo },
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
        'La solicitud no tiene detalle de cambio de domicilio',
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
      const codigo = `SOL-CD-${anio}-${randomNum}`;
      const existente = await this.solicitudRepository.findOneBy({
        codigo_solicitud: codigo,
      });
      if (!existente) return codigo;
    }
  }

  async crear(
    dto: CrearSolicitudCambioDomicilioDto,
    user: RequestUser,
  ): Promise<SolicitudCambioDomicilioResponse> {
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

    // 2. La dirección nueva debe ser distinta de la actual (se copia
    //    automáticamente como direccion_anterior).
    const direccionAnterior = abonado.direccion;
    const direccionNueva = String(dto.direccionNueva).trim();
    if (direccionNueva === '') {
      throw new BadRequestException('La dirección nueva es obligatoria');
    }
    if (
      direccionNueva.localeCompare(direccionAnterior, undefined, {
        sensitivity: 'base',
      }) === 0
    ) {
      throw new BadRequestException(
        'La dirección nueva debe ser distinta de la dirección actual',
      );
    }

    // 3. Evitar duplicados: máximo una solicitud de cambio de domicilio
    //    abierta (pendiente o en proceso) por abonado.
    const duplicada = await this.solicitudRepository.findOne({
      where: {
        abonado: { id: abonado.id },
        tipo_solicitud: TIPO_CAMBIO_DOMICILIO,
        estado: In(ESTADOS_ABIERTOS),
      },
    });
    if (duplicada) {
      throw new BadRequestException(
        `Ya existe una solicitud de cambio de domicilio en curso (${duplicada.codigo_solicitud}). Espera a que se resuelva antes de crear otra.`,
      );
    }

    // 4. Quien crea la solicitud siendo empleado queda asociado a ella.
    const empleado =
      user.role === 'abonado'
        ? null
        : await this.buscarEmpleadoDeUsuario(user.id);

    const solicitud = this.solicitudRepository.create({
      codigo_solicitud: await this.generarCodigoUnico(),
      abonado,
      tipo_solicitud: TIPO_CAMBIO_DOMICILIO,
      estado: 'pendiente',
      empleado,
    });
    const guardada = await this.solicitudRepository.save(solicitud);

    const detalle = this.detalleRepository.create({
      solicitud: guardada,
      direccion_anterior: direccionAnterior,
      direccion_nueva: direccionNueva,
      justificacion: String(dto.justificacion).trim(),
      motivo_rechazo: null,
    });
    await this.detalleRepository.save(detalle);

    return this.cargarCompleta(guardada.id);
  }

  async listar(user: RequestUser): Promise<SolicitudCambioDomicilioResponse[]> {
    // Un abonado solo ve sus propias solicitudes; un administrador las ve todas.
    const donde: FindOptionsWhere<Solicitud> = {
      tipo_solicitud: TIPO_CAMBIO_DOMICILIO,
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
  ): Promise<SolicitudCambioDomicilioResponse> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id, tipo_solicitud: TIPO_CAMBIO_DOMICILIO },
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
        'La solicitud no tiene detalle de cambio de domicilio',
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
    if (dto.estado === 'rechazado') {
      detalle.motivo_rechazo = dto.motivoRechazo?.trim() || null;
    }

    // Al aprobar, la dirección del abonado pasa a ser la dirección nueva y se
    // registra en el historial del abonado (mismo patrón que AbonadosService).
    // Si se rechaza, no se modifica nada del abonado.
    if (dto.estado === 'aprobado') {
      const usuario = await this.userRepository.findOneBy({ id: user.id });
      const email = usuario?.email ?? `usuario-${user.id}`;
      await this.historialRepository.save(
        this.historialRepository.create({
          abonado: { id: solicitud.abonado.id },
          usuario_email: email,
          campo: 'direccion',
          valor_anterior: detalle.direccion_anterior,
          valor_nuevo: detalle.direccion_nueva,
        }),
      );
      solicitud.abonado.direccion = detalle.direccion_nueva;
      await this.abonadoRepository.save(solicitud.abonado);
    }

    const guardada = await this.solicitudRepository.save(solicitud);
    if (dto.estado === 'rechazado') {
      await this.detalleRepository.save(detalle);
    }

    // Notificar por correo al abonado el resultado de su solicitud. Aislado
    // en try/catch: el estado ya se guardó, un fallo de SMTP no debe tumbar
    // la respuesta.
    if (dto.estado === 'aprobado' || dto.estado === 'rechazado') {
      try {
        await this.mailService.enviarCorreoResultadoSolicitud(
          solicitud.abonado.correo,
          {
            tipo: 'Cambio de domicilio',
            codigo: solicitud.codigo_solicitud,
            estadoResultado: dto.estado,
            motivo: detalle.motivo_rechazo ?? null,
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