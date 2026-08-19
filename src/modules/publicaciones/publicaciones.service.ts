import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Publicacion } from './entities/publicacion.entity';
import { CreatePublicacionDto } from './dto/create-publicacion.dto';

@Injectable()
export class PublicacionesService {
  constructor(
    @InjectRepository(Publicacion)
    private readonly publicacionRepository: Repository<Publicacion>,
  ) {}

  async create(createPublicacionDto: CreatePublicacionDto): Promise<Publicacion> {
    // 1. Validar campos obligatorios
    const camposObligatorios = ['titulo', 'contenido', 'categoria'];
    for (const campo of camposObligatorios) {
      const valor = (createPublicacionDto as any)[campo];
      if (!valor || String(valor).trim() === '') {
        throw new BadRequestException(`El campo '${campo}' es obligatorio`);
      }
    }

    // 2. Crear el registro. Si no se indica 'publicado', queda visible por defecto
    const nuevaPublicacion = this.publicacionRepository.create({
      titulo: createPublicacionDto.titulo,
      contenido: createPublicacionDto.contenido,
      categoria: createPublicacionDto.categoria,
      publicado:
        createPublicacionDto.publicado !== undefined
          ? createPublicacionDto.publicado
          : true,
    });

    // 3. Guardar en MySQL
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
}
