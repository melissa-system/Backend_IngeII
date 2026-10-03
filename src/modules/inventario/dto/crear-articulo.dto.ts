import {
  IsNotEmpty,
  IsString,
  IsIn,
  IsInt,
  Min,
  IsDateString,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CrearArticuloDto {
  @IsNotEmpty({ message: 'El nombre del artículo es obligatorio' })
  @IsString({ message: 'El nombre del artículo debe ser texto.' })
  @MaxLength(150, {
    message: 'El nombre del artículo no puede superar los 150 caracteres.',
  })
  nombre: string;

  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @IsString({ message: 'La descripción debe ser texto.' })
  @MaxLength(1000, {
    message: 'La descripción no puede superar los 1000 caracteres.',
  })
  descripcion: string;

  @IsIn(['inmueble', 'articulo'], {
    message: 'La clasificación debe ser "inmueble" o "articulo"',
  })
  clasificacion: 'inmueble' | 'articulo';

  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(0, { message: 'La cantidad no puede ser negativa' })
  cantidad: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El umbral mínimo debe ser un número entero' })
  @Min(1, { message: 'El umbral mínimo debe ser al menos 1' })
  umbralMinimo?: number;

  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'La fecha de ingreso debe tener un formato válido (YYYY-MM-DD)',
    },
  )
  fechaIngreso?: string;

  @IsNotEmpty({ message: 'La ubicación es obligatoria' })
  @IsString({ message: 'La ubicación debe ser texto.' })
  @MaxLength(255, {
    message: 'La ubicación no puede superar los 255 caracteres.',
  })
  ubicacion: string;

  @Type(() => Number)
  @IsInt({ message: 'El identificador del proveedor debe ser un entero' })
  @Min(1, { message: 'El identificador del proveedor es inválido' })
  proveedorId: number;

  @IsNotEmpty({ message: 'La persona que recibe es obligatoria' })
  @IsString({ message: 'La persona que recibe debe ser texto.' })
  @MaxLength(150, {
    message: 'La persona que recibe no puede superar los 150 caracteres.',
  })
  personaRecibe: string;
}
