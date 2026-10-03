import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EsCedula } from '../../../common/validacion/decoradores-validacion';

// Tipos que ofrece el formulario público de reporte de averías.
export const TIPOS_AVERIA = [
  'Fuga de agua',
  'Tubería rota',
  'Falta de presión / sin agua',
  'Contador dañado',
  'Fuga en la vía pública',
  'Otro',
];

export class CreateAveriaDto {
  @IsIn(TIPOS_AVERIA, { message: 'Seleccione un tipo de avería válido.' })
  tipo_averia: string;

  @IsString({ message: 'La descripción debe ser texto.' })
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  @MinLength(10, {
    message: 'La descripción debe tener al menos 10 caracteres.',
  })
  @MaxLength(2000, {
    message: 'La descripción no puede superar los 2000 caracteres.',
  })
  descripcion: string;

  @IsNotEmpty({ message: 'La cédula es obligatoria.' })
  @EsCedula(['fisica', 'dimex'], {
    message:
      'La cédula debe ser una cédula física (9 dígitos) o un DIMEX (11 o 12 dígitos).',
  })
  cedula_reportante: string;

  @IsString({ message: 'El nombre debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres.' })
  nombre_reportante: string;

  @IsOptional()
  @IsString({ message: 'El primer apellido debe ser texto.' })
  @MaxLength(100, {
    message: 'El primer apellido no puede superar los 100 caracteres.',
  })
  apellido1_reportante?: string;

  @IsOptional()
  @IsString({ message: 'El segundo apellido debe ser texto.' })
  @MaxLength(100, {
    message: 'El segundo apellido no puede superar los 100 caracteres.',
  })
  apellido2_reportante?: string;

  @IsOptional()
  @IsString({ message: 'La ubicación debe ser texto.' })
  @MaxLength(255, {
    message: 'La ubicación no puede superar los 255 caracteres.',
  })
  ubicacion?: string;
}
