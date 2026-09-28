import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export const MOTIVOS_FALLA_MEDIDOR = [
  'Dañado',
  'Frenado',
  'Ilegible',
  'Antigüedad',
  'Fuga en la base del medidor',
  'Desgaste o fuga en la llave de paso',
] as const;

export type MotivoFallaMedidorTipo = (typeof MOTIVOS_FALLA_MEDIDOR)[number];

export class CrearSolicitudCambioMedidorDto {
  // Solo lo usa un administrador que genera la solicitud para otra persona.
  // Si quien crea es un abonado logueado, el id se resuelve desde su token
  // y este campo se ignora. En multipart/form-data viaja como string, por
  // lo que se usa @Type(() => Number) para convertirlo antes de validar.
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El id del abonado debe ser un número entero' })
  @Min(1, { message: 'El id del abonado debe ser un número positivo' })
  idAbonado?: number;

  @IsNotEmpty({ message: 'El motivo de la falla es obligatorio' })
  @IsIn(MOTIVOS_FALLA_MEDIDOR, {
    message:
      'El motivo debe ser: Dañado, Frenado, Ilegible, Antigüedad, Fuga en la base del medidor o Desgaste o fuga en la llave de paso',
  })
  motivoFalla: MotivoFallaMedidorTipo;

  @IsNotEmpty({
    message: 'Las señas escritas o dirección física son obligatorias',
  })
  @IsString({ message: 'La dirección debe ser texto' })
  @Length(15, 255, {
    message: 'Las señas escritas deben tener entre 15 y 255 caracteres',
  })
  direccionExacta: string;

  @IsNotEmpty({ message: 'La justificación o detalle técnico es obligatorio' })
  @IsString({ message: 'La justificación debe ser texto' })
  @Length(10, 255, {
    message: 'La justificación debe tener entre 10 y 255 caracteres',
  })
  justificacion: string;
}

