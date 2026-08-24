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

@Injectable()
export class DocumentosService {
  constructor(
    @InjectRepository(Documento)
    private readonly documentoRepository: Repository<Documento>,
  ) {}

  async create(
    createDocumentoDto: CreateDocumentoDto,
    archivo?: Express.Multer.File,
  ): Promise<Documento> {
    // 1. Nombre obligatorio
    if (!createDocumentoDto.nombre || createDocumentoDto.nombre.trim() === '') {
      throw new BadRequestException("El campo 'nombre' es obligatorio");
    }

    // 2. El tipo es obligatorio y debe pertenecer al catálogo cerrado de
    // TipoDocumento (actas, informes, mediciones en el acueducto,
    // comunicados, otros). Esta es la validación pedida: "verificar que cada
    // documento tenga un tipo válido del catálogo antes de guardarse".
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

    // 4. Debe venir un archivo adjunto (ver estrategia de almacenamiento en
    // documentos.controller.ts: se guarda en disco dentro de uploads/documentos/)
    if (!archivo) {
      throw new BadRequestException('Debes adjuntar el archivo del documento');
    }

    // 5. Versionado: si ya existe un documento vigente con el mismo nombre y
    // tipo, esta carga se trata como una nueva versión del mismo documento:
    // la versión anterior pasa a 'Inhabilitado' y la nueva queda vigente
    // con version = anterior.version + 1.
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

    // 6. Crear el registro nuevo, vigente por defecto
    const nuevoDocumento = this.documentoRepository.create({
      nombre: createDocumentoDto.nombre,
      tipo: createDocumentoDto.tipo as TipoDocumento,
      version,
      ubicacion: archivo.filename,
      visibilidad: visibilidad as VisibilidadDocumento,
      estado: EstadoDocumento.VIGENTE,
    });

    // 7. Guardar en MySQL
    return await this.documentoRepository.save(nuevoDocumento);
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

  // Edición de metadatos y/o cambio manual de estado (inhabilitar/reactivar)
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
}
