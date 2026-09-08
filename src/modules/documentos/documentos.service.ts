import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Documento } from './entities/documento.entity';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';
import {
  TipoDocumento,
  VisibilidadDocumento,
  EstadoDocumento,
} from './enums/documento.enums';
import { EmpleadosService } from '../empleados/empleados.service';
import { CloudinaryService } from '../../config/cloudinary.service';

// Carpeta dentro de la cuenta de Cloudinary donde viven estos documentos
const CARPETA_CLOUDINARY = 'ASADA/documentos';

@Injectable()
export class DocumentosService {
  constructor(
    @InjectRepository(Documento)
    private readonly documentoRepository: Repository<Documento>,
    private readonly empleadosService: EmpleadosService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // Ningún documento (vigente o inhabilitado) puede compartir nombre con
  // otro: si ya existe, hay que usar "Actualizar versión" sobre ESE
  // documento en vez de subir uno nuevo con el mismo nombre. excluirId se
  // usa desde update() para no comparar un documento contra sí mismo al
  // renombrarlo.
  private async verificarNombreUnico(
    nombre: string,
    excluirId?: number,
  ): Promise<void> {
    const existente = await this.documentoRepository.findOne({
      where: { nombre: Like(nombre.trim()) },
    });
    if (existente && existente.id !== excluirId) {
      throw new BadRequestException(
        `Ya existe un documento con el nombre "${nombre.trim()}". Si querés reemplazar su archivo, usá "Actualizar versión" en ese documento en vez de subir uno nuevo.`,
      );
    }
  }

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

    // 5. El nombre debe ser único en todo el repositorio (vigentes e
    // inhabilitados): un documento "nuevo" con un nombre que ya existe no
    // se trata como versión automáticamente — para eso está
    // agregarNuevaVersion(), que actúa sobre un documento puntual por id, no
    // por coincidencia de nombre.
    await this.verificarNombreUnico(createDocumentoDto.nombre);

    // 6. Todas las validaciones que no dependen del archivo ya pasaron, así
    // que recién ahora se sube: si algo de lo anterior fallaba, no se gastó
    // cuota de Cloudinary ni quedó un archivo huérfano.
    const archivoSubido = await this.cloudinaryService.subirArchivo(
      archivo,
      CARPETA_CLOUDINARY,
    );

    try {
      const empleado = usuarioId
        ? await this.empleadosService.buscarPorUsuarioId(usuarioId)
        : null;

      const nuevoDocumento = this.documentoRepository.create({
        nombre: createDocumentoDto.nombre.trim(),
        tipo: createDocumentoDto.tipo as TipoDocumento,
        version: 1,
        ubicacion: archivoSubido.url,
        public_id: archivoSubido.publicId,
        visibilidad: visibilidad as VisibilidadDocumento,
        estado: EstadoDocumento.VIGENTE,
        empleado,
      });

      return await this.documentoRepository.save(nuevoDocumento);
    } catch (error) {
      // El archivo ya está en Cloudinary; si el guardado en MySQL falla, hay
      // que borrarlo para no dejarlo huérfano.
      await this.cloudinaryService.eliminarArchivo(
        archivoSubido.publicId,
        archivo.mimetype.startsWith('image/'),
      );
      throw error;
    }
  }

  // Nueva versión de un documento EXISTENTE (identificado por id, no por
  // nombre): sube el archivo nuevo, inhabilita la versión actual (se
  // conserva tal cual para consultar el historial — no se borra su archivo
  // de Cloudinary) y crea una fila nueva con version+1, mismo
  // nombre/tipo/visibilidad, vigente.
  async agregarNuevaVersion(
    id: number,
    archivo?: Express.Multer.File,
    usuarioId?: number,
  ): Promise<Documento> {
    // 1. El documento debe existir.
    const actual = await this.documentoRepository.findOneBy({ id });
    if (!actual) {
      throw new NotFoundException(`El documento con el ID ${id} no fue encontrado`);
    }

    // 2. Solo se puede versionar a partir de la versión vigente: un
    // documento inhabilitado es historial congelado, no el punto de partida
    // para seguir versionando.
    if (actual.estado !== EstadoDocumento.VIGENTE) {
      throw new BadRequestException(
        'Solo se puede agregar una nueva versión a partir de la versión vigente de un documento.',
      );
    }

    // 3. Debe venir el archivo nuevo.
    if (!archivo) {
      throw new BadRequestException('Debes adjuntar el nuevo archivo');
    }

    const archivoSubido = await this.cloudinaryService.subirArchivo(
      archivo,
      CARPETA_CLOUDINARY,
    );

    try {
      // La versión anterior queda inhabilitada pero conserva su archivo en
      // Cloudinary: sigue siendo consultable como historial.
      actual.estado = EstadoDocumento.INHABILITADO;
      await this.documentoRepository.save(actual);

      const empleado = usuarioId
        ? await this.empleadosService.buscarPorUsuarioId(usuarioId)
        : null;

      const nuevaVersion = this.documentoRepository.create({
        nombre: actual.nombre,
        tipo: actual.tipo,
        version: actual.version + 1,
        ubicacion: archivoSubido.url,
        public_id: archivoSubido.publicId,
        visibilidad: actual.visibilidad,
        estado: EstadoDocumento.VIGENTE,
        empleado,
      });

      return await this.documentoRepository.save(nuevaVersion);
    } catch (error) {
      await this.cloudinaryService.eliminarArchivo(
        archivoSubido.publicId,
        archivo.mimetype.startsWith('image/'),
      );
      throw error;
    }
  }

  // Valida que un filtro de tipo recibido por query string pertenezca al
  // catálogo cerrado de TipoDocumento. undefined/'' se interpreta como "sin
  // filtro" (no es un error). Cualquier otro valor que no esté en el
  // catálogo se rechaza con un mensaje claro.
  private validarFiltroTipo(tipo?: string): TipoDocumento | undefined {
    if (!tipo) return undefined;
    if (!Object.values(TipoDocumento).includes(tipo as TipoDocumento)) {
      throw new BadRequestException(
        `El tipo de documento debe ser uno de: ${Object.values(TipoDocumento).join(', ')}`,
      );
    }
    return tipo as TipoDocumento;
  }

  // Usado por el dashboard administrativo: todos los documentos, vigentes e
  // inhabilitados, más recientes primero. Admite filtro por tipo (catálogo
  // cerrado, ver validarFiltroTipo) y búsqueda opcional por nombre
  // (coincidencia parcial, sin distinguir mayúsculas por la collation por
  // defecto de MySQL en este proyecto).
  async findAll(filtros?: { tipo?: string; nombre?: string }): Promise<Documento[]> {
    const tipo = this.validarFiltroTipo(filtros?.tipo);
    const nombre = filtros?.nombre?.trim();

    return await this.documentoRepository.find({
      where: {
        ...(tipo && { tipo }),
        ...(nombre && { nombre: Like(`%${nombre}%`) }),
      },
      order: { fecha_carga: 'DESC' },
    });
  }

  // Consulta pública, consumida por el landing (Noticias): solo documentos
  // 'Público' y vigentes, para mostrarlos como card junto a las
  // publicaciones. No requiere sesión.
  async findPublicos(): Promise<Documento[]> {
    return await this.documentoRepository.find({
      where: {
        visibilidad: VisibilidadDocumento.PUBLICO,
        estado: EstadoDocumento.VIGENTE,
      },
      order: { fecha_carga: 'DESC' },
    });
  }

  // "Documentos oficiales": lo que ve un abonado (o cualquier usuario
  // autenticado) desde su perfil. Todo lo vigente, sin filtrar por
  // visibilidad — tanto 'Interno' como 'Público' son documentación oficial
  // ya que quien consulta esta ruta ya inició sesión. Los inhabilitados
  // (versiones reemplazadas) no aparecen: solo interesa la versión actual.
  // Admite el mismo filtro por tipo que findAll, para que un abonado también
  // pueda encontrar rápido lo que busca en su propia vista.
  async findOficiales(tipo?: string): Promise<Documento[]> {
    const tipoValidado = this.validarFiltroTipo(tipo);
    return await this.documentoRepository.find({
      where: {
        estado: EstadoDocumento.VIGENTE,
        ...(tipoValidado && { tipo: tipoValidado }),
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
      updateDocumentoDto.nombre !== undefined &&
      updateDocumentoDto.nombre.trim().toLowerCase() !==
        documento.nombre.trim().toLowerCase()
    ) {
      await this.verificarNombreUnico(updateDocumentoDto.nombre, id);
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