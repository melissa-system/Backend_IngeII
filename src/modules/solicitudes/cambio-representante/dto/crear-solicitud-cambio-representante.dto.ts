import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
  Min,
} from 'class-validator';
import {
  EsCedula,
  EsTelefono,
} from '../../../../common/validacion/decoradores-validacion';

// Cédula, teléfono y correo siguen las reglas comunes del sistema
// (common/validacion), igual que el resto de formularios.
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
  @MaxLength(150, { message: 'El nombre no puede superar los 150 caracteres.' })
  representanteNuevoNombre: string;

  @IsNotEmpty({ message: 'La cédula del nuevo representante es obligatoria' })
  @EsCedula()
  representanteNuevoCedula: string;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser texto' })
  representanteNuevoDireccion?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo del nuevo representante no es válido' })
  representanteNuevoCorreo?: string;

  @ValidateIf(
    (o: CrearSolicitudCambioRepresentanteDto) => !!o.representanteNuevoTelefono,
  )
  @EsTelefono({
    message:
      'El teléfono del nuevo representante debe tener 8 dígitos (ej. 8888-8888).',
  })
  representanteNuevoTelefono?: string;

  @IsNotEmpty({ message: 'La justificación es obligatoria' })
  @IsString({ message: 'La justificación debe ser texto' })
  @Length(10, 255, {
    message: 'La justificación debe tener entre 10 y 255 caracteres',
  })
  justificacion: string;
}
