import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Solicitud } from './entities/solicitud.entity';
import { SolicitudCambioRepresentante } from './entities/solicitud-cambio-representante.entity';
import { Abonado } from '../abonados/entities/abonado.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { User } from '../auth/entities/user.entity';
import { HistorialAbonado } from '../abonados/entities/historial-abonado.entity';
import { MailService } from '../auth/mail.service';
import { CloudinaryService } from '../../config/cloudinary.service';
import { CrearSolicitudCambioRepresentanteDto } from './dto/crear-solicitud-cambio-representante.dto';
import { ActualizarEstadoSolicitudDto } from './dto/actualizar-estado-solicitud.dto';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

export const TIPO_CAMBIO_REPRESENTANTE = 'cambio_representante';

const ESTADOS_ABIERTOS = ['pendiente', 'en_proceso'];
const ESTADOS_FINALES = ['aprobado', 'rechazado'];

// Forma "plana" que consume el frontend: junta la fila de solicitudes con el
// detalle de cambio de representante y los datos del abonado en un solo objeto.
export interface SolicitudCambioRepresentanteResponse {
  id: number;
  codigo_solicitud: string;
  id_abonado: number;
  numero_abonado: string;
  nombre_abonado: string;
  cedula: string;
  correo: string;
  tipo_solicitud: string;
  estado: string;
  representante_anterior_nombre: string;
  representante_anterior_cedula: string;
  representante_nuevo_nombre: string;
  representante_nuevo_cedula: string;
  representante_nuevo_direccion: string;
  representante_nuevo_correo: string | null;
  representante_nuevo_telefono: string | null;
  copia_cedula_url: string | null;
  justificacion: string;
  motivo_rechazo: string | null;
  id_empleado: number | null;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
}

@Injectable()
export class CambioRepresentanteService {
  constructor(
    @InjectRepository(Solicitud)
    private readonly solicitudRepository: Repository<Solicitud>,
    @InjectRepository(SolicitudCambioRepresentante)
    private readonly detalleRepository: Repository<SolicitudCambioRepresentante>,
    @InjectRepository(Abonado)
    private readonly abonadoRepository: Repository<Abonado>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(HistorialAbonado)
    private readonly historialRepository: Repository<HistorialAbonado>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly mailService: MailService,
  ) {}

  private construirRespuesta(
    solicitud: Solicitud,
    detalle: SolicitudCambioRepresentante,
  ): SolicitudCambioRepresentanteResponse {
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
      representante_anterior_nombre: detalle.representante_anterior_nombre,
      representante_anterior_cedula: detalle.representante_anterior_cedula,
      representante_nuevo_nombre: detalle.representante_nuevo_nombre,
      representante_nuevo_cedula: detalle.representante_nuevo_cedula,
      representante_nuevo_direccion: detalle.representante_nuevo_direccion,
      representante_nuevo_correo: detalle.representante_nuevo_correo,
      representante_nuevo_telefono: detalle.representante_nuevo_telefono,
      copia_cedula_url: detalle.copia_cedula_url,
      justificacion: detalle.justificacion,
      motivo_rechazo: detalle.motivo_rechazo,
      id_empleado: solicitud.empleado?.id ?? null,
      fecha_creacion: solicitud.fecha_creacion,
      fecha_actualizacion: solicitud.fecha_actualizacion,
    };
  }

  private async cargarCompleta(
    id: number,
  ): Promise<SolicitudCambioRepresentanteResponse> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id, tipo_solicitud: TIPO_CAMBIO_REPRESENTANTE },
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
        'La solicitud no tiene detalle de cambio de representante',
      );
    }
    return this.construirRespuesta(solicitud, detalle);
  }

  private buscarAbonadoDeUsuario(usuarioId: number): Promise<Abonado | null> {
    return this.abonadoRepository.findOne({
      where: { usuario: { id: usuarioId } },
      relations: { juridico: true },
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
      const codigo = `SOL-REP-${anio}-${randomNum}`;
      const existente = await this.solicitudRepository.findOneBy({
        codigo_solicitud: codigo,
      });
      if (!existente) return codigo;
    }
  }

  // Compara cédulas ignorando formatos distintos de la misma identificación
  // (con o sin guiones): "1-2222-3333" === "122223333".
  private cedulasIguales(a: string, b: string): boolean {
    return a.replace(/\D/g, '') === b.replace(/\D/g, '');
  }

  async crear(
    dto: CrearSolicitudCambioRepresentanteDto,
    file: Express.Multer.File,
    user: RequestUser,
  ): Promise<SolicitudCambioRepresentanteResponse> {
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
      abonado = await this.abonadoRepository.findOne({
        where: { id: dto.idAbonado },
        relations: { juridico: true },
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

    // 2. Solo los abonados jurídicos tienen representante legal.
    if (abonado.tipo_abonado !== 'Jurídica' || !abonado.juridico) {
      throw new BadRequestException(
        'Solo los abonados jurídicos pueden solicitar un cambio de representante legal',
      );
    }

    // 3. El nuevo representante debe ser distinto del actual (se copia
    //    automáticamente como representante_anterior).
    const representanteAnteriorNombre =
      abonado.juridico.nombre_representante_legal?.trim() || '';
    const representanteAnteriorCedula =
      abonado.juridico.cedula_representante?.trim() || '';
    if (
      this.cedulasIguales(
        dto.representanteNuevoCedula,
        representanteAnteriorCedula,
      )
    ) {
      throw new BadRequestException(
        'La cédula del nuevo representante debe ser distinta de la cédula del representante actual',
      );
    }

    // 4. Evitar duplicados: máximo una solicitud de cambio de representante
    //    abierta (pendiente o en proceso) por abonado.
    const duplicada = await this.solicitudRepository.findOne({
      where: {
        abonado: { id: abonado.id },
        tipo_solicitud: TIPO_CAMBIO_REPRESENTANTE,
        estado: In(ESTADOS_ABIERTOS),
      },
    });
    if (duplicada) {
      throw new BadRequestException(
        `Ya existe una solicitud de cambio de representante en curso (${duplicada.codigo_solicitud}). Espera a que se resuelva antes de crear otra.`,
      );
    }

    // 5. Subir la foto o PDF de la cédula del nuevo representante a Cloudinary.
    const esImagen = file.mimetype.startsWith('image/');
    const uploadResult = await this.cloudinaryService.subirArchivo(
      file,
      'solicitudes/cambio-representante',
    );

    // 6. Quien crea la solicitud siendo empleado queda asociado a ella.
    const empleado =
      user.role === 'abonado'
        ? null
        : await this.buscarEmpleadoDeUsuario(user.id);

    const solicitud = this.solicitudRepository.create({
      codigo_solicitud: await this.generarCodigoUnico(),
      abonado,
      tipo_solicitud: TIPO_CAMBIO_REPRESENTANTE,
      estado: 'pendiente',
      empleado,
    });
    const guardada = await this.solicitudRepository.save(solicitud);

    const detalle = this.detalleRepository.create({
      solicitud: guardada,
      representante_anterior_nombre: representanteAnteriorNombre,
      representante_anterior_cedula: representanteAnteriorCedula,
      representante_nuevo_nombre: dto.representanteNuevoNombre.trim(),
      representante_nuevo_cedula: dto.representanteNuevoCedula.trim(),
      representante_nuevo_direccion: dto.representanteNuevoDireccion.trim(),
      representante_nuevo_correo: dto.representanteNuevoCorreo?.trim() || null,
      representante_nuevo_telefono: dto.representanteNuevoTelefono?.trim() || null,
      justificacion: dto.justificacion.trim(),
      copia_cedula_url: uploadResult.url,
      copia_cedula_public_id: uploadResult.publicId,
      motivo_rechazo: null,
    });
    try {
      await this.detalleRepository.save(detalle);
    } catch (error) {
      // Rollback: si falló el guardado en BD, no dejar la cédula huérfana en
      // Cloudinary.
      await this.cloudinaryService.eliminarArchivo(
        uploadResult.publicId,
        esImagen,
      );
      throw error;
    }

    return this.cargarCompleta(guardada.id);
  }

  async listar(user: RequestUser): Promise<SolicitudCambioRepresentanteResponse[]> {
    // Un abonado solo ve sus propias solicitudes; un administrador las ve todas.
    const donde: FindOptionsWhere<Solicitud> = {
      tipo_solicitud: TIPO_CAMBIO_REPRESENTANTE,
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
  ): Promise<SolicitudCambioRepresentanteResponse> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id, tipo_solicitud: TIPO_CAMBIO_REPRESENTANTE },
      relations: { abonado: { juridico: true }, empleado: true },
    });
    if (!solicitud) {
      throw new NotFoundException('La solicitud no fue encontrada');
    }
    const detalle = await this.detalleRepository.findOneBy({
      solicitud: { id: solicitud.id },
    });
    if (!detalle) {
      throw new NotFoundException(
        'La solicitud no tiene detalle de cambio de representante',
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

    // Al aprobar, el abonado jurídico adopta los datos del nuevo representante
    // y se registra en el historial del abonado. Si se rechaza, no se modifica
    // nada del abonado.
    if (dto.estado === 'aprobado') {
      const juridico = solicitud.abonado.juridico;
      if (!juridico) {
        throw new BadRequestException(
          'El abonado no tiene un representante legal registrado',
        );
      }

      const usuario = await this.userRepository.findOneBy({ id: user.id });
      const email = usuario?.email ?? `usuario-${user.id}`;

      const cambios = [
        {
          campo: 'nombre_representante_legal',
          valor_anterior: juridico.nombre_representante_legal,
          valor_nuevo: detalle.representante_nuevo_nombre,
        },
        {
          campo: 'cedula_representante',
          valor_anterior: juridico.cedula_representante,
          valor_nuevo: detalle.representante_nuevo_cedula,
        },
        {
          campo: 'representante_direccion',
          valor_anterior: juridico.representante_direccion,
          valor_nuevo: detalle.representante_nuevo_direccion,
        },
        {
          campo: 'representante_correo',
          valor_anterior: juridico.representante_correo,
          valor_nuevo: detalle.representante_nuevo_correo,
        },
        {
          campo: 'representante_telefono',
          valor_anterior: juridico.representante_telefono,
          valor_nuevo: detalle.representante_nuevo_telefono,
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

      juridico.nombre_representante_legal = detalle.representante_nuevo_nombre;
      juridico.cedula_representante = detalle.representante_nuevo_cedula;
      juridico.representante_direccion = detalle.representante_nuevo_direccion;
      juridico.representante_correo = detalle.representante_nuevo_correo;
      juridico.representante_telefono = detalle.representante_nuevo_telefono;
      await this.abonadoRepository.save(solicitud.abonado);
    }

    const guardada = await this.solicitudRepository.save(solicitud);
    if (dto.estado === 'rechazado') {
      await this.detalleRepository.save(detalle);
    }

    // Notificar por correo al abonado y al nuevo representante el resultado
    // de la solicitud. Aislado en try/catch: el estado ya se guardó, un fallo
    // de SMTP no debe tumbar la respuesta.
    if (dto.estado === 'aprobado' || dto.estado === 'rechazado') {
      try {
        await this.mailService.enviarCorreoResultadoCambioRepresentante(
          solicitud.abonado.correo,
          detalle.representante_nuevo_correo,
          {
            tipo: 'Cambio de representante',
            codigo: solicitud.codigo_solicitud,
            estadoResultado: dto.estado as 'aprobado' | 'rechazado',
            motivo: detalle.motivo_rechazo ?? null,
            nombreNuevoRepresentante: detalle.representante_nuevo_nombre,
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