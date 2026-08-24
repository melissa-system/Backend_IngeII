import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
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

// --- Estrategia de almacenamiento físico de los archivos ---
// Igual que los adjuntos de solicitudes de paja de agua: los archivos se
// guardan en disco, dentro de uploads/documentos/, con un nombre único
// (timestamp + sufijo aleatorio) para evitar colisiones y no depender del
// nombre original que suba la persona usuaria. Ese nombre generado es lo que
// se guarda en Documento.ubicacion, y main.ts expone la carpeta uploads/
// completa como archivos estáticos, así que el archivo queda accesible en
// /uploads/documentos/<nombre-generado>. No se usa almacenamiento en la
// base de datos (BLOB) para no inflar las consultas ni los backups de MySQL.
@Controller('documentos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Post()
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'documentos');
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${uniqueSuffix}${extname(safeName)}`);
        },
      }),
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
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    return this.documentosService.create(createDocumentoDto, archivo);
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
}
