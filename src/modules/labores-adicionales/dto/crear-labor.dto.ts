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

// Tipos de actividad que puede tener una labor adicional (no incluye
// "atención de avería": eso se gestiona desde el módulo de averías).
export const TIPOS_LABOR = [
  'reparacion',
  'instalacion',
  'mantenimiento',
  'otro',
] as const;

export const ESTADOS_LABOR = [
  'Pendiente',
  'En proceso',
  'En revisión',
  'Finalizado',
] as const;

export class CrearLaborDto {
  @IsIn(TIPOS_LABOR, {
    message: `El tipo de labor debe ser uno de: ${TIPOS_LABOR.join(', ')}`,
  })
  tipoActividad: string;

  @IsString()
  @MinLength(10, {
    message: 'Describe la labor con al menos 10 caracteres',
  })
  @MaxLength(2000, {
    message: 'La descripción no puede superar los 2000 caracteres',
  })
  descripcion: string;

  // Fontanero al que se asigna. Opcional: puede asignarse después.
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El fontanero seleccionado no es válido' })
  @Min(1, { message: 'El fontanero seleccionado no es válido' })
  empleadoId?: number;
}
