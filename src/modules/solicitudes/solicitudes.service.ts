import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SolicitudPajaAgua } from './entities/solicitud-paja-agua.entity';
import { CreateSolicitudPajaAguaDto } from './dto/create-solicitud-paja-agua.dto';
import { CloudinaryService } from '../../config/cloudinary.service';

// Ventana de tiempo para considerar una solicitud como duplicada (10 minutos)
const VENTANA_DUPLICADO_MINUTOS = 10;

// Carpeta dentro de la cuenta de Cloudinary donde viven estos adjuntos
const CARPETA_CLOUDINARY = 'ASADA/solicitudes';

@Injectable()
export class SolicitudesService {
  constructor(
    @InjectRepository(SolicitudPajaAgua)
    private readonly solicitudRepository: Repository<SolicitudPajaAgua>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(
    datosSolicitud: CreateSolicitudPajaAguaDto,
    files: {
      permisosMunicipales?: Express.Multer.File[];
      cartaSolicitud?: Express.Multer.File[];
    },
  ): Promise<SolicitudPajaAgua> {
    // 0. Evitar duplicidad: si ya existe una solicitud reciente con la misma
    // identificación, no se registra otra en un periodo corto de tiempo.
    // Esta validación va ANTES de subir nada a Cloudinary, para no dejar
    // archivos huérfanos en la nube si la solicitud termina rechazada.
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

    // 2. Generar código automático único
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const codigoGenerado = `SOL-2026-${randomNum}`;

    // 3. Crear la entidad con todos los campos obligatorios completos
    const nuevaSolicitud = this.solicitudRepository.create({
      codigo_solicitud: datosSolicitud.codigoSolicitud || codigoGenerado,
      tipo_persona: datosSolicitud.tipoPersona,
      nombre_solicitante: datosSolicitud.nombreSolicitante,
      identificacion: datosSolicitud.identificacion,
      nombre_representante: datosSolicitud.nombreRepresentante || null,
      cedula_representante: datosSolicitud.cedulaRepresentante || null,
      telefono: datosSolicitud.telefono,
      correo: datosSolicitud.correo,
      direccion: datosSolicitud.direccion,
      numero_plano: datosSolicitud.numeroPlano,
      observaciones: datosSolicitud.observaciones || null,
      permisos_municipales_path: permisos.url,
      permisos_municipales_public_id: permisos.publicId,
      carta_solicitud_path: carta.url,
      carta_solicitud_public_id: carta.publicId,
      estado: 'Pendiente',
    });

    // 4. Guardar en MySQL
    return await this.solicitudRepository.save(nuevaSolicitud);
  }

  async findAll(): Promise<SolicitudPajaAgua[]> {
    return await this.solicitudRepository.find();
  }
}