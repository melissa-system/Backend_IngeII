import { IsIn, IsOptional } from 'class-validator';

// Sin estado se alterna (activo <-> inactivo); con estado debe ser uno válido.
export class CambiarEstadoArticuloDto {
  @IsOptional()
  @IsIn(['activo', 'inactivo'], {
    message: "El estado debe ser 'activo' o 'inactivo'.",
  })
  estado?: 'activo' | 'inactivo';
}
