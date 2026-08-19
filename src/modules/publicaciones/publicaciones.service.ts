import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Publicacion } from './entities/publicacion.entity';
import { CreatePublicacionDto } from './dto/create-publicacion.dto';
import { UpdatePublicacionDto } from './dto/update-publicacion.dto';

// Límites de caracteres: deben coincidir con el largo de columna en la entidad
const LIMITES = {
  titulo: 120,
  contenido: 400,
  categoria: 40,
};

@Injectable()
export class PublicacionesService {
  constructor(
    @InjectRepository(Publicacion)
    private readonly publicacionRepository: Repository<Publicacion>,
  ) {}

  private validarLongitudes(datos: {
    titulo?: string;
    contenido?: string;
    categoria?: string;
  }) {
    for (const campo of ['titulo', 'contenido', 'categoria'] as const) {
      const valor = datos[campo];
      const limite = LIMITES[campo];
      if (valor !== undefined && valor.length > limite) {
        throw new BadRequestException(
          `El campo '${campo}' no puede superar los ${limite} caracteres`,
        );
      }
    }
  }

  async create(createPublicacionDto: CreatePublicacionDto): Promise<Publicacion> {
    // 1. Validar campos obligatorios
    const camposObligatorios = ['titulo', 'contenido', 'categoria'];
    for (const campo of camposObligatorios) {
      const valor = (createPublicacionDto as any)[campo];
      if (!valor || String(valor).trim() === '') {
        throw new BadRequestException(`El campo '${campo}' es obligatorio`);
      }
    }

    // 2. Validar longitud máxima de cada campo de texto
    this.validarLongitudes(createPublicacionDto);

    // 3. Crear el registro. Si no se indica 'publicado', queda visible por defecto
    const nuevaPublicacion = this.publicacionRepository.create({
      titulo: createPublicacionDto.titulo,
      contenido: createPublicacionDto.contenido,
      categoria: createPublicacionDto.categoria,
      publicado:
        createPublicacionDto.publicado !== undefined
          ? createPublicacionDto.publicado
          : true,
    });

    // 4. Guardar en MySQL
    return await this.publicacionRepository.save(nuevaPublicacion);
  }

  // Usado por el landing público: solo publicaciones visibles, más recientes primero
  async findPublicadas(): Promise<Publicacion[]> {
    return await this.publicacionRepository.find({
      where: { publicado: true },
      order: { fecha_publicacion: 'DESC' },
    });
  }

  // Usado por el dashboard administrativo: incluye borradores
  async findAll(): Promise<Publicacion[]> {
    return await this.publicacionRepository.find({
      order: { fecha_publicacion: 'DESC' },
    });
  }

  // Edición de campos y/o cambio de estado publicado/borrador
  async update(
    id: number,
    updatePublicacionDto: UpdatePublicacionDto,
  ): Promise<Publicacion> {
    const publicacion = await this.publicacionRepository.findOneBy({ id });
    if (!publicacion) {
      throw new NotFoundException(`La publicación con el ID ${id} no fue encontrada`);
    }

    // 1. Si vienen campos de texto vacíos explícitamente, no se permite
    for (const campo of ['titulo', 'contenido', 'categoria'] as const) {
      const valor = updatePublicacionDto[campo];
      if (valor !== undefined && valor.trim() === '') {
        throw new BadRequestException(`El campo '${campo}' no puede quedar vacío`);
      }
    }

    // 2. Validar longitud máxima de los campos que vengan en la actualización
    this.validarLongitudes(updatePublicacionDto);

    // 3. Aplicar solo los campos enviados
    Object.assign(publicacion, updatePublicacionDto);

    // 4. Guardar cambios
    return await this.publicacionRepository.save(publicacion);
  }
}
