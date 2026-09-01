import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { UpdateConfiguracionDto } from './dto/update-configuracion.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Role } from '../../common/enums/roles.enum';

@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly service: ConfiguracionService) {}

  /**
   * Retorna la configuración de la ASADA.
   * Ruta pública — el landing y el footer la necesitan sin autenticación.
   */
  @Public()
  @Get()
  obtener() {
    return this.service.obtener();
  }

  /**
   * Actualiza la configuración de la ASADA.
   * Solo administradores y junta directiva.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch()
  actualizar(@Body() dto: UpdateConfiguracionDto) {
    return this.service.actualizar(dto);
  }
}
