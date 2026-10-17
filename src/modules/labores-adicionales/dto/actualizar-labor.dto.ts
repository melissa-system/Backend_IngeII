import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ESTADOS_LABOR, TIPOS_LABOR } from './crear-labor.dto';

export class ActualizarLaborDto {
  @IsOptional()
  @IsIn(TIPOS_LABOR, {
    message: `El tipo de labor debe ser uno de: ${TIPOS_LABOR.join(', ')}`,
  })
  tipoActividad?: string;

  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Describe la labor con al menos 10 caracteres' })
  @MaxLength(2000, {
    message: 'La descripción no puede superar los 2000 caracteres',
  })
  descripcion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El fontanero seleccionado no es válido' })
  @Min(1, { message: 'El fontanero seleccionado no es válido' })
  empleadoId?: number;

  @IsOptional()
  @IsIn(ESTADOS_LABOR, {
    message: `El estado debe ser uno de: ${ESTADOS_LABOR.join(', ')}`,
  })
  estado?: string;

  @IsOptional()
  @IsString({ message: 'La observación debe ser texto.' })
  @MaxLength(1000, {
    message: 'La observación no puede superar los 1000 caracteres.',
  })
  observacion?: string;
}
