import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SolicitudPajaAgua } from '../entities/solicitud-paja-agua.entity';
import { CreateSolicitudPajaAguaDto } from '../dto/create-solicitud-paja-agua.dto';
import { ActualizarEstadoSolicitudPajaAguaDto } from '../dto/actualizar-estado-solicitud-paja-agua.dto';
import { CloudinaryService } from '../../../../config/cloudinary.service';
import { BitacoraService } from '../../../bitacora/bitacora.service';
import { ModuloBitacora } from '../../../bitacora/entities/bitacora.enums';
import { MailService } from '../../../auth/mail.service';
import { AbonadosService } from '../../../abonados/abonados.service';
import { Abonado } from '../../../abonados/entities/abonado.entity';
import { Empleado } from '../../../empleados/entities/empleado.entity';
import { User } from '../../../auth/entities/user.entity';
import type { RequestUser } from '../../../auth/strategies/jwt.strategy';

const ESTADOS_CERRADOS = ['Aprobada', 'Rechazada', 'Completada'];

// Ventana de tiempo para considerar una solicitud como duplicada (10 minutos)
const VENTANA_DUPLICADO_MINUTOS = 10;

// Carpeta dentro de la cuenta de Cloudinary donde viven estos adjuntos
const CARPETA_CLOUDINARY = 'ASADA/solicitudes';

@Injectable()
export class SolicitudesService {
  constructor(
    @InjectRepository(SolicitudPajaAgua)
    private readonly solicitudRepository: Repository<SolicitudPajaAgua>,
    @InjectRepository(Abonado)
    private readonly abonadoRepository: Repository<Abonado>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly bitacoraService: BitacoraService,
    private readonly mailService: MailService,
    private readonly abonadosService: AbonadosService,
  ) {}

  async create(
    datosSolicitud: CreateSolicitudPajaAguaDto,
    files: {
      permisosMunicipales?: Express.Multer.File[];
      cartaSolicitud?: Express.Multer.File[];
      cedulaFrente?: Express.Multer.File[];
      cedulaDorso?: Express.Multer.File[];
    },
    
  ): Promise<SolicitudPajaAgua> {
    // 0. Evitar duplicidad: si ya existe una solicitud reciente con la misma
    // identificación, no se registra otra en un periodo corto de tiempo.
    // Esta validación va ANTES de subir nada a Cloudinary, para no gastar
    // cuota ni dejar archivos huérfanos en el caso más común de rechazo.
    const existente = await this.solicitudRepository.findOne({
      where: { identificacion: datosSolicitud.identificacion },
      order: { fecha_solicitud: 'DESC' },
    });

    if (existente) {
      const limite = new Date(
        Date.now() - VENTANA_DUPLICADO_MINUTOS * 60 * 1000,
      );
      if (new Date(existente.fecha_solicitud) >= limite) {
        throw new ConflictException(
          `Ya existe una solicitud reciente con esta identificación. Tu código de seguimiento es: ${existente.codigo_solicitud}`,
        );
      }
    }

    // 1. Subir los adjuntos a Cloudinary (el controller ya garantizó que
    // ambos vienen presentes y dentro del tamaño permitido).
    const permisos = await this.cloudinaryService.subirArchivo(
      files.permisosMunicipales![0],
      CARPETA_CLOUDINARY,
    );
    const carta = await this.cloudinaryService.subirArchivo(
      files.cartaSolicitud![0],
      CARPETA_CLOUDINARY,
    );
    const cedulaFrente = await this.cloudinaryService.subirArchivo(
      files.cedulaFrente![0],
      CARPETA_CLOUDINARY,
    );
    const cedulaDorso = await this.cloudinaryService.subirArchivo(
      files.cedulaDorso![0],
      CARPETA_CLOUDINARY,
    );

    // 2. A partir de aquí los archivos YA están en la nube. Si el guardado en
    // MySQL falla (código duplicado, error de conexión, validación), esos dos
    // archivos quedarían huérfanos: subidos, ocupando cuota, y sin ninguna
    // fila que los referencie ni forma de encontrarlos después. Por eso todo
    // lo que sigue va dentro de un try/catch que los borra si algo falla.
    try {
      // 2a. Generar código automático único
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const codigoGenerado = `SOL-2026-${randomNum}`;

      // 2b. Crear la entidad con todos los campos obligatorios completos
      const nuevaSolicitud = this.solicitudRepository.create({
        codigo_solicitud: datosSolicitud.codigoSolicitud || codigoGenerado,
        tipo_persona: datosSolicitud.tipoPersona,
        nombre_solicitante: datosSolicitud.nombreSolicitante,
        identificacion: datosSolicitud.identificacion,
        nombre_representante: datosSolicitud.nombreRepresentante || null,
        cedula_representante: datosSolicitud.cedulaRepresentante || null,
        telefono: datosSolicitud.telefono,
        telefono_secundario: datosSolicitud.telefonoSecundario || null,
        correo: datosSolicitud.correo,
        provincia: datosSolicitud.provincia,
        canton: datosSolicitud.canton,
        distrito: datosSolicitud.distrito,
        direccion: datosSolicitud.direccion,
        numero_plano: datosSolicitud.numeroPlano,
        naturaleza_inmueble: datosSolicitud.naturalezaInmueble,
        calidad_titular: datosSolicitud.calidadTitular,
        tipo_servicio: datosSolicitud.tipoServicio,
        tipo_conexion: datosSolicitud.tipoConexion,
        observaciones: datosSolicitud.observaciones || null,
        permisos_municipales_path: permisos.url,
        permisos_municipales_public_id: permisos.publicId,
        carta_solicitud_path: carta.url,
        carta_solicitud_public_id: carta.publicId,
        cedula_frente_path: cedulaFrente.url,
        cedula_frente_public_id: cedulaFrente.publicId,
        cedula_dorso_path: cedulaDorso.url,
        cedula_dorso_public_id: cedulaDorso.publicId,
        estado: 'Pendiente',
      });

      // 2c. Guardar en MySQL
      const guardada = await this.solicitudRepository.save(nuevaSolicitud);

      // 2d. Auditar la creación en la bitácora general.
      //
      // Esta solicitud llega del formulario público, SIN sesión iniciada: en
      // ese momento el solicitante todavía no es usuario ni abonado del
      // sistema. Por eso el autor va con id null y el correo que escribió en
      // el formulario, que es el único dato de contacto que lo identifica.
      //
      // Va después del save y no lanza excepción si falla (ver
      // BitacoraService): si la auditoría falla, la solicitud ya quedó
      // registrada igual y el solicitante no pierde su trámite.
      await this.bitacoraService.registrarCreacion(
        ModuloBitacora.SOLICITUDES,
        guardada.id,
        { id: null, email: datosSolicitud.correo },
        `Solicitud de paja de agua ${guardada.codigo_solicitud} creada desde el formulario público`,
      );

      return guardada;
    } catch (error) {
      // Rollback: la solicitud no se guardó, así que sus archivos no deben
      // quedarse en la nube. eliminarArchivo no lanza excepción si falla, así
      // que el error original (el que le importa al usuario) se propaga
      // intacto en vez de quedar tapado por un fallo de limpieza.
      await this.cloudinaryService.eliminarArchivo(permisos.publicId, false);
      await this.cloudinaryService.eliminarArchivo(carta.publicId, false);
      await this.cloudinaryService.eliminarArchivo(cedulaFrente.publicId, false);
      await this.cloudinaryService.eliminarArchivo(cedulaDorso.publicId, false);
      throw error;
    }
  }

  async findAll(): Promise<SolicitudPajaAgua[]> {
    return await this.solicitudRepository.find({
      relations: { empleado: true, abonado: true },
      order: { fecha_solicitud: 'DESC' },
    });
  }

  // Correo del usuario autenticado que gestiona la solicitud. RequestUser
  // solo trae el id, así que se consulta en la BD (la bitácora guarda el
  // correo para conservar quién hizo la acción aunque después se elimine la
  // cuenta) — mismo patrón que en SolicitudesOtroService.
  private async correoDeUsuario(usuarioId: number): Promise<string | null> {
    const usuario = await this.userRepository.findOneBy({ id: usuarioId });
    return usuario?.email ?? null;
  }

  // Al aprobar la solicitud: reutiliza el Abonado si ya existe uno con esa
  // cédula o ese correo (por ejemplo, alguien que ya es abonado pidiendo una
  // conexión adicional); si no existe, lo crea — AbonadosService.create ya
  // se encarga de aprovisionar la cuenta de acceso y mandar el correo para
  // definir contraseña.
  private async resolverAbonado(
    solicitud: SolicitudPajaAgua,
  ): Promise<Abonado> {
    const existente =
      (await this.abonadoRepository.findOneBy({
        cedula: solicitud.identificacion,
      })) ??
      (await this.abonadoRepository.findOneBy({ correo: solicitud.correo }));
    if (existente) return existente;

    const esJuridica = solicitud.tipo_persona === 'juridica';
    const creado = await this.abonadosService.create({
      tipo_abonado: esJuridica ? 'Jurídica' : 'Física',
      nombre: solicitud.nombre_solicitante,
      numero_plano_catastrado: solicitud.numero_plano || undefined,
      nombre_representante_legal: esJuridica
        ? (solicitud.nombre_representante ?? undefined)
        : undefined,
      cedula_representante: esJuridica
        ? (solicitud.cedula_representante ?? undefined)
        : undefined,
      cedula: solicitud.identificacion,
      telefono: solicitud.telefono,
      correo: solicitud.correo,
      direccion: solicitud.direccion,
    });
    return this.abonadoRepository.findOneByOrFail({ id: creado.id });
  }

  async cambiarEstado(
    id: number,
    dto: ActualizarEstadoSolicitudPajaAguaDto,
    user: RequestUser,
  ): Promise<SolicitudPajaAgua> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id },
      relations: { empleado: true, abonado: true },
    });
    if (!solicitud) {
      throw new NotFoundException('La solicitud no fue encontrada');
    }
    if (ESTADOS_CERRADOS.includes(solicitud.estado)) {
      throw new BadRequestException(
        'La solicitud ya está cerrada (aprobada o rechazada) y no admite más cambios',
      );
    }

    const estadoAnterior = solicitud.estado;

    const empleado = await this.empleadoRepository.findOne({
      where: { usuario: { id: user.id } },
    });
    if (empleado) {
      solicitud.empleado = empleado;
    }

    solicitud.estado = dto.estado;

    if (dto.estado === 'Rechazada') {
      solicitud.motivo_rechazo = dto.motivoRechazo?.trim() || null;
    }

    // Al aprobar: crear/vincular el Abonado para habilitar la segunda parte
    // del trámite. Aislado en try/catch: si esto falla (cédula duplicada
    // como empleado, SMTP caído, etc.), el cambio de estado ya se guardó
    // igual y se puede vincular el abonado a mano después desde Abonados.
    if (dto.estado === 'Aprobada') {
      try {
        solicitud.abonado = await this.resolverAbonado(solicitud);
      } catch (error) {
        console.error(
          `No se pudo crear/vincular el abonado al aprobar la solicitud ${solicitud.codigo_solicitud}:`,
          error,
        );
      }
    }

    const guardada = await this.solicitudRepository.save(solicitud);

    // Auditoría del cambio de estado. Va después del save: solo se audita lo
    // que efectivamente quedó guardado.
    await this.bitacoraService.registrarCambioEstado(
      ModuloBitacora.SOLICITUDES,
      solicitud.id,
      { id: user.id, email: await this.correoDeUsuario(user.id) },
      estadoAnterior,
      dto.estado,
      dto.motivoRechazo?.trim() || 'Actualización de estado',
    );

    // Notificar por correo al solicitante. Aislado en try/catch: el estado
    // ya se guardó, un fallo de SMTP no debe tumbar la respuesta.
    if (dto.estado === 'Aprobada' || dto.estado === 'Rechazada') {
      try {
        await this.mailService.enviarCorreoResultadoPajaAgua(
          solicitud.correo,
          {
            codigo: solicitud.codigo_solicitud,
            estadoResultado: dto.estado as 'Aprobada' | 'Rechazada',
            motivo: solicitud.motivo_rechazo,
          },
        );
      } catch (error) {
        console.error(
          `No se pudo notificar por correo el resultado de la solicitud ${solicitud.codigo_solicitud}:`,
          error,
        );
      }
    }

    return guardada;
  }
}