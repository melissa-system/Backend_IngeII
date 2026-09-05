import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Documento } from './entities/documento.entity';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';
import {
  TipoDocumento,
  VisibilidadDocumento,
  EstadoDocumento,
} from './enums/documento.enums';
import { User } from '../auth/entities/user.entity';
import { CloudinaryService } from '../../config/cloudinary.service';

// Carpeta dentro de la cuenta de Cloudinary donde viven estos documentos
const CARPETA_CLOUDINARY = 'ASADA/documentos';

@Injectable()
export class DocumentosService {
  constructor(
    @InjectRepository(Documento)
    private readonly documentoRepository: Repository<Documento>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(
    createDocumentoDto: CreateDocumentoDto,
    archivo?: Express.Multer.File,
    usuarioId?: number,
  ): Promise<Documento> {
    // 1. Nombre obligatorio
    if (!createDocumentoDto.nombre || createDocumentoDto.nombre.trim() === '') {
      throw new BadRequestException("El campo 'nombre' es obligatorio");
    }

    // 2. El tipo es obligatorio y debe pertenecer al catálogo cerrado de
    // TipoDocumento (actas, informes, mediciones en el acueducto,
    // comunicados, otros).
    if (
      !createDocumentoDto.tipo ||
      !Object.values(TipoDocumento).includes(
        createDocumentoDto.tipo as TipoDocumento,
      )
    ) {
      throw new BadRequestException(
        `El tipo de documento debe ser uno de: ${Object.values(TipoDocumento).join(', ')}`,
      );
    }

    // 3. Visibilidad: opcional, 'Interno' por defecto. Si viene, debe ser válida.
    const visibilidad =
      createDocumentoDto.visibilidad ?? VisibilidadDocumento.INTERNO;
    if (
      !Object.values(VisibilidadDocumento).includes(
        visibilidad as VisibilidadDocumento,
      )
    ) {
      throw new BadRequestException(
        `La visibilidad debe ser uno de: ${Object.values(VisibilidadDocumento).join(', ')}`,
      );
    }

    // 4. Debe venir un archivo adjunto
    if (!archivo) {
      throw new BadRequestException('Debes adjuntar el archivo del documento');
    }

    // 5. Todas las validaciones que no dependen del archivo ya pasaron, así
    // que recién ahora se sube: si algo de lo anterior fallaba, no se gastó
    // cuota de Cloudinary ni quedó un archivo huérfano.
    const archivoSubido = await this.cloudinaryService.subirArchivo(
      archivo,
      CARPETA_CLOUDINARY,
    );

    // 6. A partir de aquí el archivo YA está en la nube: si el guardado en
    // MySQL falla, hay que borrarlo para no dejarlo huérfano.
    try {
      // 6a. Versionado: si ya existe un documento vigente con el mismo nombre
      // y tipo, esta carga se trata como una nueva versión del mismo
      // documento: la versión anterior pasa a 'Inhabilitado' y la nueva queda
      // vigente con version = anterior.version + 1.
      //
      // Nota: la versión anterior CONSERVA su archivo en Cloudinary a
      // propósito — el historial de versiones debe seguir siendo consultable.
      // Por eso aquí NO se llama a eliminarArchivo sobre la versión vieja.
      const anterior = await this.documentoRepository.findOne({
        where: {
          nombre: createDocumentoDto.nombre,
          tipo: createDocumentoDto.tipo as TipoDocumento,
          estado: EstadoDocumento.VIGENTE,
        },
        order: { version: 'DESC' },
      });

      let version = 1;
      if (anterior) {
        version = anterior.version + 1;
        anterior.estado = EstadoDocumento.INHABILITADO;
        await this.documentoRepository.save(anterior);
      }

      // 6b. Quién lo sube: el usuario autenticado que hace la petición.
      const subidoPor = usuarioId
        ? await this.userRepository.findOneBy({ id: usuarioId })
        : null;

      // 6c. Crear el registro nuevo, vigente por defecto
      const nuevoDocumento = this.documentoRepository.create({
        nombre: createDocumentoDto.nombre,
        tipo: createDocumentoDto.tipo as TipoDocumento,
        version,
        ubicacion: archivoSubido.url,
        public_id: archivoSubido.publicId,
        visibilidad: visibilidad as VisibilidadDocumento,
        estado: EstadoDocumento.VIGENTE,
        subido_por: subidoPor,
      });

      // 6d. Guardar en MySQL
      return await this.documentoRepository.save(nuevoDocumento);
    } catch (error) {
      // Rollback del archivo recién subido. No se revierte el cambio de
      // estado de la versión anterior a propósito: es una operación aparte y
      // recuperable a mano desde el dashboard (PATCH /documentos/:id), a
      // diferencia de un archivo huérfano en la nube, que nadie va a
      // encontrar nunca.
      await this.cloudinaryService.eliminarArchivo(
        archivoSubido.publicId,
        archivo.mimetype.startsWith('image/'),
      );
      throw error;
    }
  }

  // Usado por el dashboard administrativo: todos los documentos, vigentes e
  // inhabilitados, más recientes primero.
  async findAll(): Promise<Documento[]> {
    return await this.documentoRepository.find({
      order: { fecha_carga: 'DESC' },
    });
  }

  // Consulta pública (futuro landing): solo documentos visibles y vigentes.
  async findPublicos(): Promise<Documento[]> {
    return await this.documentoRepository.find({
      where: {
        visibilidad: VisibilidadDocumento.PUBLICO,
        estado: EstadoDocumento.VIGENTE,
      },
      order: { fecha_carga: 'DESC' },
    });
  }

  // Edición de metadatos y/o cambio manual de estado (inhabilitar/reactivar).
  // No toca el archivo: inhabilitar es reversible y conserva el historial.
  async update(
    id: number,
    updateDocumentoDto: UpdateDocumentoDto,
  ): Promise<Documento> {
    const documento = await this.documentoRepository.findOneBy({ id });
    if (!documento) {
      throw new NotFoundException(`El documento con el ID ${id} no fue encontrado`);
    }

    if (
      updateDocumentoDto.nombre !== undefined &&
      updateDocumentoDto.nombre.trim() === ''
    ) {
      throw new BadRequestException("El campo 'nombre' no puede quedar vacío");
    }

    if (
      updateDocumentoDto.visibilidad !== undefined &&
      !Object.values(VisibilidadDocumento).includes(
        updateDocumentoDto.visibilidad as VisibilidadDocumento,
      )
    ) {
      throw new BadRequestException(
        `La visibilidad debe ser uno de: ${Object.values(VisibilidadDocumento).join(', ')}`,
      );
    }

    if (
      updateDocumentoDto.estado !== undefined &&
      !Object.values(EstadoDocumento).includes(
        updateDocumentoDto.estado as EstadoDocumento,
      )
    ) {
      throw new BadRequestException(
        `El estado debe ser uno de: ${Object.values(EstadoDocumento).join(', ')}`,
      );
    }

    Object.assign(documento, updateDocumentoDto);
    return await this.documentoRepository.save(documento);
  }

  // Eliminación DEFINITIVA de un documento: borra la fila de MySQL y también
  // el archivo de Cloudinary. Distinto de 'Inhabilitado' (update), que es
  // reversible y conserva el archivo.
  //
  // El archivo se borra DESPUÉS de eliminar la fila: si el borrado de la fila
  // falla, el documento sigue completo y usable. Al revés (borrar el archivo
  // primero) dejaría una fila apuntando a una URL rota.
  async remove(id: number): Promise<{ mensaje: string }> {
    const documento = await this.documentoRepository.findOneBy({ id });
    if (!documento) {
      throw new NotFoundException(`El documento con el ID ${id} no fue encontrado`);
    }

    const publicId = documento.public_id;

    await this.documentoRepository.remove(documento);

    // Los registros anteriores a la migración no tienen public_id (su archivo
    // vive en uploads/ del servidor); en ese caso no hay nada que borrar en la
    // nube y eliminarArchivo simplemente no hace nada.
    if (publicId) {
      await this.cloudinaryService.eliminarArchivo(publicId, false);
    }

    return { mensaje: 'Documento eliminado correctamente' };
  }
}