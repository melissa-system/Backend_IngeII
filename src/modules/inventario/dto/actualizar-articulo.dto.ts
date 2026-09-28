import { PartialType } from '@nestjs/mapped-types';
import { CrearArticuloDto } from './crear-articulo.dto';
import { IsOptional, IsIn } from 'class-validator';

export class ActualizarArticuloDto extends PartialType(CrearArticuloDto) {
  @IsOptional()
  @IsIn(['activo', 'inactivo'], {
    message: 'El estado debe ser "activo" o "inactivo"',
  })
  estado?: 'activo' | 'inactivo';
}

