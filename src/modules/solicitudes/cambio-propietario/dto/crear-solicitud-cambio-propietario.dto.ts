import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export const MOTIVOS_TRASPASO_VALIDOS = [
  'Compraventa',
  'Donación',
  'Herencia / Sucesión',
  'Cesión voluntaria',
] as const;

export type MotivoTraspaso = (typeof MOTIVOS_TRASPASO_VALIDOS)[number];

export class CrearSolicitudCambioPropietarioDto {
  // Opcional: solo se usa cuando un administrador crea la solicitud en nombre
  // de un abonado (atención en ventanilla). Para el rol 'abonado', el ID se toma
  // directamente del token JWT y enviar un id ajeno resulta en 403 Forbidden.
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El id del abonado debe ser un número entero' })
  @Min(1, { message: 'El id del abonado debe ser mayor a 0' })
  idAbonado?: number;

  @IsNotEmpty({ message: 'El nombre del nuevo propietario es obligatorio' })
  @IsString({ message: 'El nombre del nuevo propietario debe ser texto' })
  @Length(5, 255, {
    message: 'El nombre del nuevo propietario debe tener entre 5 y 255 caracteres',
  })
  nombreNuevoPropietario: string;

  @IsNotEmpty({ message: 'La cédula del nuevo propietario es obligatoria' })
  @IsString({ message: 'La cédula del nuevo propietario debe ser texto' })
  cedulaNuevoPropietario: string;

  @IsNotEmpty({ message: 'El teléfono del nuevo propietario es obligatorio' })
  @IsString({ message: 'El teléfono del nuevo propietario debe ser texto' })
  telefonoNuevoPropietario: string;

  @IsNotEmpty({ message: 'El correo electrónico del nuevo propietario es obligatorio' })
  @IsEmail(
    {},
    { message: 'El correo electrónico del nuevo propietario debe tener un formato válido' },
  )
  correoNuevoPropietario: string;

  @IsNotEmpty({ message: 'El motivo del traspaso es obligatorio' })
  @IsIn(MOTIVOS_TRASPASO_VALIDOS, {
    message:
      'El motivo debe ser: Compraventa, Donación, Herencia / Sucesión o Cesión voluntaria',
  })
  motivoTraspaso: MotivoTraspaso;

  @IsNotEmpty({ message: 'La justificación es obligatoria' })
  @IsString({ message: 'La justificación debe ser texto' })
  @Length(10, 255, {
    message: 'La justificación debe tener entre 10 y 255 caracteres',
  })
  justificacion: string;
}

