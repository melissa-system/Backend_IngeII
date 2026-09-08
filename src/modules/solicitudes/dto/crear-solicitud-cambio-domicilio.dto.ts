import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CrearSolicitudCambioDomicilioDto {
  // Solo lo usa un administrador que genera la solicitud para otra persona.
  // Si quien crea es un abonado logueado, el id se resuelve desde su token
  // y este campo se ignora.
  @IsOptional()
  @IsInt({ message: 'El id del abonado debe ser un número entero' })
  @Min(1, { message: 'El id del abonado debe ser un número positivo' })
  idAbonado?: number;

  @IsNotEmpty({ message: 'La dirección nueva es obligatoria' })
  @IsString()
  direccionNueva: string;

  @IsNotEmpty({ message: 'La justificación es obligatoria' })
  @IsString()
  justificacion: string;
}