import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ReportesFontaneroService } from './reportes-fontanero.service';
import { CrearReporteFontaneroDto } from './dto/crear-reporte-fontanero.dto';
import { FiltrarReportesFontaneroDto } from './dto/filtrar-reportes-fontanero.dto';
import { RevisarReporteFontaneroDto } from './dto/revisar-reporte-fontanero.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

// Evidencia opcional: solo imágenes, máximo 5 MB (igual que el validador del
// frontend FileDropZone).
const MAX_TAMANO_EVIDENCIA = 5 * 1024 * 1024;
const MIME_EVIDENCIA = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

@Controller('reportes-fontanero')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportesFontaneroController {
  constructor(private readonly service: ReportesFontaneroService) {}

  // POST /reportes-fontanero
  // Solo el fontanero registra su actividad. El SUPER_ADMIN (Junta Directiva)
  // también pasa, porque el RolesGuard le da acceso total al sistema.
  // La evidencia (imagen) es opcional y viaja como multipart/form-data.
  @Post()
  @Roles(Role.FONTANERO)
  @UseInterceptors(
    FileInterceptor('evidencia', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_TAMANO_EVIDENCIA },
      fileFilter: (_req, file, callback) => {
        if (!MIME_EVIDENCIA.includes(file.mimetype)) {
          callback(
            new BadRequestException(
              'La evidencia debe ser una imagen (JPG, PNG, GIF o WEBP).',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  crear(
    @Body() dto: CrearReporteFontaneroDto,
    @Request() req: { user?: RequestUser },
    @UploadedFile() evidencia?: Express.Multer.File,
  ) {
    return this.service.crear(dto, req.user!, evidencia);
  }

  // GET /reportes-fontanero/mis-reportes
  // Los reportes del fontanero autenticado, para su propia pantalla.
  // Va ANTES de la ruta ':id' para que 'mis-reportes' no se interprete como
  // un id.
  @Get('mis-reportes')
  @Roles(Role.FONTANERO)
  misReportes(@Request() req: { user?: RequestUser }) {
    return this.service.misReportes(req.user!);
  }

  // GET /reportes-fontanero?empleadoId=&tipoActividad=&desde=&hasta=&pagina=
  // Consulta administrativa con filtros y paginación.
  @Get()
  @Roles(Role.ADMIN)
  buscar(@Query() filtros: FiltrarReportesFontaneroDto) {
    return this.service.buscar(filtros);
  }

  // GET /reportes-fontanero/:id — detalle con el desglose de materiales.
  @Get(':id')
  @Roles(Role.ADMIN)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.service.obtenerPorId(id);
  }

  // PATCH /reportes-fontanero/:id/revision — la administración aprueba o
  // rechaza la resolución de la avería. Al aprobar, la avería queda
  // Finalizado; al rechazar, vuelve a En proceso.
  @Patch(':id/revision')
  @Roles(Role.ADMIN)
  revisar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RevisarReporteFontaneroDto,
    @Request() req: { user?: RequestUser },
  ) {
    return this.service.revisar(id, dto, req.user!);
  }
}
