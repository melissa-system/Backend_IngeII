import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentosService } from './documentos.service';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { Public } from '../../common/decorators/public.decorator';
import {
  MAX_DOCUMENTO_FILE_SIZE,
  multerFileFilterDocumento,
  validarTamanoDocumento,
} from './documento-upload.config';

// --- Estrategia de almacenamiento de los archivos ---
// Los archivos se reciben en MEMORIA (memoryStorage) y el service los sube a
// Cloudinary, que devuelve la URL pública y el public_id. Ya no se escribe
// nada en el disco del servidor: así los archivos sobreviven a reinicios y
// redespliegues, y no dependen del almacenamiento local del hosting.
//
// Nota sobre guards: van por método (no a nivel de clase) porque este
// controlador mezcla rutas con distinto nivel de acceso — administración
// (solo admin), consulta para abonados (cualquier usuario autenticado) y
// consulta pública para el landing (sin sesión). JwtAuthGuard no respeta
// @Public() (ver el mismo criterio en publicaciones.controller.ts), así que
// la única forma de dejar una ruta realmente pública es no aplicarle el
// guard en absoluto.
@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_DOCUMENTO_FILE_SIZE },
      fileFilter: multerFileFilterDocumento,
    }),
  )
  create(
    @Body() createDocumentoDto: CreateDocumentoDto,
    @Request() req: { user?: RequestUser },
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    validarTamanoDocumento(archivo);

    return this.documentosService.create(
      createDocumentoDto,
      archivo,
      req.user?.id,
    );
  }

  // POST /documentos/:id/version
  // Nueva versión de un documento EXISTENTE (no crea uno nuevo): sube el
  // archivo, inhabilita la versión vigente actual y crea la fila con
  // version+1. Mismas reglas de formato/tamaño que la carga inicial (ver
  // documento-upload.config.ts).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/version')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_DOCUMENTO_FILE_SIZE },
      fileFilter: multerFileFilterDocumento,
    }),
  )
  agregarNuevaVersion(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: RequestUser },
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    validarTamanoDocumento(archivo);

    return this.documentosService.agregarNuevaVersion(
      id,
      archivo,
      req.user?.id,
    );
  }

  // Listado completo para el dashboard administrativo: vigentes e
  // inhabilitados, de cualquier visibilidad. Admite ?tipo= (debe pertenecer
  // al catálogo TipoDocumento, se valida en el service) y ?nombre=
  // (búsqueda parcial, opcional) para poder ubicar un documento rápido
  // dentro del repositorio.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  findAll(@Query('tipo') tipo?: string, @Query('nombre') nombre?: string) {
    return this.documentosService.findAll({ tipo, nombre });
  }

  // "Documentos oficiales": lo que ve un abonado (o cualquier usuario con
  // sesión) desde su propio perfil. Sin @Roles: cualquier rol autenticado
  // pasa el RolesGuard (ver roles.guard.ts, "si la ruta no especifica
  // ningún rol, se permite el paso"). Solo documentos vigentes, sin
  // importar si son 'Interno' o 'Público' — ambos son documentación
  // oficial para un abonado ya identificado; 'Público' además se promociona
  // aparte en Noticias (ver /documentos/publicos). Admite ?tipo= igual que
  // el listado administrativo.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('oficiales')
  findOficiales(@Query('tipo') tipo?: string) {
    return this.documentosService.findOficiales(tipo);
  }

  // Consumida por el landing público (sección Noticias), para mostrar los
  // documentos marcados como 'Público' junto con las publicaciones. Sin
  // ningún guard: es la única forma de que quede realmente pública.
  @Public()
  @Get('publicos')
  findPublicos() {
    return this.documentosService.findPublicos();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDocumentoDto: UpdateDocumentoDto,
  ) {
    return this.documentosService.update(id, updateDocumentoDto);
  }

  // DELETE /documentos/:id
  // Eliminación DEFINITIVA: borra el registro y el archivo de Cloudinary.
  // Para dar de baja un documento conservando el historial, usar en su lugar
  // PATCH /documentos/:id con estado 'Inhabilitado'.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.documentosService.remove(id);
  }
}