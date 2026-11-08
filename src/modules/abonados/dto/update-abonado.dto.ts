import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  EsCedula,
  EsCorreo,
  EsTelefono,
} from '../../../common/validacion/decoradores-validacion';

// La cédula y el tipo de abonado no se editan; el resto sigue las mismas
// reglas que CreateAbonadoDto.
export class UpdateAbonadoDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre no puede quedar vacío.' })
  @MaxLength(150, { message: 'El nombre no puede superar los 150 caracteres.' })
  nombre?: string;

  // Solo física (van a abonados_fisicos)
  @IsOptional()
  @IsString({ message: 'El primer apellido debe ser texto.' })
  @MaxLength(100, {
    message: 'El primer apellido no puede superar los 100 caracteres.',
  })
  apellido1?: string;

  @IsOptional()
  @IsString({ message: 'El segundo apellido debe ser texto.' })
  @MaxLength(100, {
    message: 'El segundo apellido no puede superar los 100 caracteres.',
  })
  apellido2?: string;

  @IsOptional()
  @IsString({ message: 'El número de plano catastrado debe ser texto.' })
  @MaxLength(50, {
    message:
      'El número de plano catastrado no puede superar los 50 caracteres.',
  })
  numero_plano_catastrado?: string;

  // Solo jurídica (van a abonados_juridicos)
  @IsOptional()
  @IsString({ message: 'El nombre del representante legal debe ser texto.' })
  @MaxLength(150, {
    message:
      'El nombre del representante legal no puede superar los 150 caracteres.',
  })
  nombre_representante_legal?: string;

  @IsOptional()
  @EsCedula(['fisica', 'dimex'], {
    message:
      'La cédula del representante legal debe ser una cédula física (9 dígitos) o un DIMEX (11 o 12 dígitos).',
  })
  cedula_representante?: string;

  @IsOptional()
  @EsTelefono()
  telefono?: string;

  @IsOptional()
  @EsCorreo()
  @MaxLength(150, { message: 'El correo no puede superar los 150 caracteres.' })
  correo?: string;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser texto.' })
  @IsNotEmpty({ message: 'La dirección no puede quedar vacía.' })
  @MaxLength(255, {
    message: 'La dirección no puede superar los 255 caracteres.',
  })
  direccion?: string;
}
