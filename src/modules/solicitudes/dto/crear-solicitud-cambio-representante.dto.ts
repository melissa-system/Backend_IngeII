import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

// Formatos de identificación válidos en Costa Rica:
//   Cédula física:   1-2345-6789
//   Cédula jurídica: 3-101-123456 (1-3-6 dígitos)
//   DIMEX:           11 o 12 dígitos
const IDENTIFICACION_REGEX = /^(\d{1}-\d{4}-\d{4}|\d{1}-\d{3}-\d{6}|\d{11,12})$/;

export class CrearSolicitudCambioRepresentanteDto {
  // Solo lo usa un administrador que genera la solicitud para otro abonado.
  // Si quien crea es un abonado logueado, el id se resuelve desde su token
  // y este campo se ignora. En multipart/form-data viaja como string, por
  // lo que se usa @Type(() => Number) para convertirlo antes de validar.
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El id del abonado debe ser un número entero' })
  @Min(1, { message: 'El id del abonado debe ser un número positivo' })
  idAbonado?: number;

  @IsNotEmpty({ message: 'El nombre del nuevo representante es obligatorio' })
  @IsString({ message: 'El nombre debe ser texto' })
  representanteNuevoNombre: string;

  @IsNotEmpty({ message: 'La cédula del nuevo representante es obligatoria' })
  @Matches(IDENTIFICACION_REGEX, {
    message:
      'Formato de cédula inválido. Usa cédula (1-2345-6789), cédula jurídica (3-101-123456) o DIMEX (11-12 dígitos)',
  })
  representanteNuevoCedula: string;

  @IsNotEmpty({
    message: 'La dirección del nuevo representante es obligatoria',
  })
  @IsString({ message: 'La dirección debe ser texto' })
  representanteNuevoDireccion: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo del nuevo representante no es válido' })
  representanteNuevoCorreo?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono del nuevo representante debe ser texto' })
  representanteNuevoTelefono?: string;

  @IsNotEmpty({ message: 'La justificación es obligatoria' })
  @IsString({ message: 'La justificación debe ser texto' })
  justificacion: string;
}