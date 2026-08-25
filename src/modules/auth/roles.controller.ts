import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, (Role as any).SUPER_ADMIN, (Role as any).ADMINISTRADOR)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() {
    return this.rolesService.findAllRoles();
  }

  @Get('permisos')
  findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }

  @Post()
  createRole(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.createRole(createRoleDto);
  }

  @Put(':id')
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: CreateRoleDto,
  ) {
    return this.rolesService.updateRole(id, updateDto);
  }

  @Delete(':id')
  deleteRole(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.deleteRole(id);
  }

  @Post(':id/permisos')
  assignPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignDto: AssignPermissionsDto,
  ) {
    return this.rolesService.assignPermissionsToRole(id, assignDto);
  }
}