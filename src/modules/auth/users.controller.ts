import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CambiarEstadoUsuarioDto } from './dto/cambiar-estado-usuario.dto';
import { CambiarRolUsuarioDto } from './dto/cambiar-rol-usuario.dto';
import { CrearUsuarioAdminDto } from './dto/crear-usuario-admin.dto';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class UsersController {
    constructor(
        private readonly authService: AuthService,
        private readonly rolesService: RolesService,
    ) { }

    // Listar usuarios del sistema (Task 2)
    @Get()
    async findAll() {
        return this.authService.listarUsuarios();
    }

    // Obtener catálogo de roles disponibles
    @Get('roles-disponibles')
    async findRoles() {
        return this.rolesService.findAllRoles();
    }

    // Registrar nuevo usuario administrativo (Task 4)
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() dto: CrearUsuarioAdminDto) {
        return this.authService.crearUsuarioPorAdmin(
            dto.email,
            dto.password,
            dto.role_id,
        );
    }

    // Cambiar estado activo/inactivo (Task 6). No se puede uno mismo
    // inhabilitar (ver AuthService.cambiarEstadoUsuario), por eso se manda
    // el id de quien hace la petición.
    @Patch(':id/estado')
    async cambiarEstado(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: CambiarEstadoUsuarioDto,
        @Req() req: Request,
    ) {
        const { id: solicitanteId } = req.user as { id: number };
        return this.authService.cambiarEstadoUsuario(id, dto.isActive, solicitanteId);
    }

    // Cambiar rol de un usuario (Task 6)
    @Patch(':id/rol')
    async cambiarRol(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: CambiarRolUsuarioDto,
    ) {
        return this.authService.cambiarRolUsuario(id, dto.role_id);
    }
}