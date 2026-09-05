import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
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

// Tamaño máximo permitido por archivo (10 MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Tipos MIME permitidos: documentos de oficina, PDF e imágenes (para actas
// o mediciones escaneadas/fotografiadas)
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
];

// --- Estrategia de almacenamiento de los archivos ---
// Los archivos se reciben en MEMORIA (memoryStorage) y el service los sube a
// Cloudinary, que devuelve la URL pública y el public_id. Ya no se escribe
// nada en el disco del servidor: así los archivos sobreviven a reinicios y
// redespliegues, y no dependen del almacenamiento local del hosting.
@Controller('documentos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Post()
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(
            new BadRequestException(
              'Solo se permiten archivos PDF, Word, Excel o imágenes (JPG, PNG)',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  create(
    @Body() createDocumentoDto: CreateDocumentoDto,
    @Request() req: { user?: RequestUser },
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    return this.documentosService.create(
      createDocumentoDto,
      archivo,
      req.user?.id,
    );
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.documentosService.findAll();
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
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
  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.documentosService.remove(id);
  }
}