import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import { ESTADOS_LABOR, TIPOS_LABOR } from './crear-labor.dto';

export class FiltrarLaboresDto {
  @IsOptional()
  @IsIn(ESTADOS_LABOR, {
    message: `El estado debe ser uno de: ${ESTADOS_LABOR.join(', ')}`,
  })
  estado?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El fontanero seleccionado no es válido' })
  empleadoId?: number;

  @IsOptional()
  @IsIn(TIPOS_LABOR, {
    message: `El tipo de labor debe ser uno de: ${TIPOS_LABOR.join(', ')}`,
  })
  tipoActividad?: string;
}
