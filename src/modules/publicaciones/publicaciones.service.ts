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
import { EmpleadosService } from '../empleados/empleados.service';
import { User } from '../auth/entities/user.entity';
import { BitacoraService } from '../bitacora/bitacora.service';
import { ModuloBitacora } from '../bitacora/entities/bitacora.enums';

// Límites de caracteres: deben coincidir con el largo de columna en la entidad
const LIMITES = {
  titulo: 120,
  contenido: 400,
  categoria: 40,
};

// Máximo de publicaciones que se muestran en el landing público a la vez
const MAX_PUBLICADAS_LANDING = 10;

// Largo máximo de un valor guardado en la bitácora. El contenido de una
// publicación puede ser largo; en la bitácora interesa SABER que cambió, no
// guardar una copia completa del texto en cada edición.
const LARGO_MAXIMO_BITACORA = 80;

@Injectable()
export class PublicacionesService {
  constructor(
    @InjectRepository(Publicacion)
    private readonly publicacionRepository: Repository<Publicacion>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly empleadosService: EmpleadosService,
    private readonly bitacoraService: BitacoraService,
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

  // Autor de un movimiento para la bitácora. RequestUser solo trae el id, así
  // que el correo se busca en la BD: la bitácora lo guarda para conservar
  // quién hizo la acción aunque después se elimine la cuenta.
  private async autorDe(usuarioId?: number) {
    if (!usuarioId) return null;
    const usuario = await this.userRepository.findOneBy({ id: usuarioId });
    return { id: usuarioId, email: usuario?.email ?? null };
  }

  private recortar(valor: string | null): string | null {
    if (valor === null) return null;
    return valor.length > LARGO_MAXIMO_BITACORA
      ? `${valor.slice(0, LARGO_MAXIMO_BITACORA)}…`
      : valor;
  }

  async create(
    createPublicacionDto: CreatePublicacionDto,
    usuarioId?: number,
  ): Promise<Publicacion> {
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

    // 3. Quién la crea: el empleado vinculado a la cuenta autenticada que
    // hace la petición (si lo hay y si esa cuenta tiene empleado vinculado)
    const empleado = usuarioId
      ? await this.empleadosService.buscarPorUsuarioId(usuarioId)
      : null;

    // 4. Crear el registro. Si no se indica 'publicado', queda visible por defecto
    const nuevaPublicacion = this.publicacionRepository.create({
      titulo: createPublicacionDto.titulo,
      contenido: createPublicacionDto.contenido,
      categoria: createPublicacionDto.categoria,
      publicado:
        createPublicacionDto.publicado !== undefined
          ? createPublicacionDto.publicado
          : true,
      empleado,
    });

    // 5. Guardar en MySQL
    const guardada = await this.publicacionRepository.save(nuevaPublicacion);

    // 6. Auditar la creación en la bitácora general
    const autor = await this.autorDe(usuarioId);
    if (autor) {
      await this.bitacoraService.registrarCreacion(
        ModuloBitacora.PUBLICACIONES,
        guardada.id,
        autor,
        `Publicación "${guardada.titulo}" creada ${
          guardada.publicado ? 'y publicada' : 'como borrador'
        }`,
      );
    }

    return guardada;
  }

  // Usado por el landing público: solo publicaciones visibles, más recientes
  // primero. Se limita a MAX_PUBLICADAS_LANDING para no saturar la página
  // pública aunque en el dashboard existan muchas más.
  async findPublicadas(): Promise<Publicacion[]> {
    return await this.publicacionRepository.find({
      where: { publicado: true },
      order: { fecha_publicacion: 'DESC' },
      take: MAX_PUBLICADAS_LANDING,
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
    usuarioId?: number,
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

    // 3. Copia de los valores ANTES de aplicar los cambios: después del
    // Object.assign el original se pierde y ya no se puede comparar.
    const antes = { ...publicacion } as Record<string, unknown>;

    // 4. Aplicar solo los campos enviados
    Object.assign(publicacion, updatePublicacionDto);

    // 5. Guardar cambios
    const guardada = await this.publicacionRepository.save(publicacion);

    // 6. Auditar en la bitácora general
    const autor = await this.autorDe(usuarioId);
    if (autor) {
      // Publicar u ocultar un aviso del sitio público se registra como
      // CAMBIO DE ESTADO, aparte de las ediciones de texto: es el movimiento
      // más relevante (qué ve la comunidad) y así se puede filtrar solo eso.
      if (
        updatePublicacionDto.publicado !== undefined &&
        antes.publicado !== updatePublicacionDto.publicado
      ) {
        await this.bitacoraService.registrarCambioEstado(
          ModuloBitacora.PUBLICACIONES,
          guardada.id,
          autor,
          antes.publicado ? 'publicada' : 'borrador',
          updatePublicacionDto.publicado ? 'publicada' : 'borrador',
          `Publicación "${guardada.titulo}"`,
        );
      }

      const cambios = BitacoraService.compararCampos(
        antes,
        updatePublicacionDto as unknown as Record<string, unknown>,
        ['titulo', 'contenido', 'categoria'],
      ).map((c) => ({
        campo: c.campo,
        valor_anterior: this.recortar(c.valor_anterior),
        valor_nuevo: this.recortar(c.valor_nuevo),
      }));

      if (cambios.length > 0) {
        await this.bitacoraService.registrarEdicion(
          ModuloBitacora.PUBLICACIONES,
          guardada.id,
          autor,
          cambios,
        );
      }
    }

    return guardada;
  }
}