import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { MIN_MOTIVO_RECHAZO } from '../../solicitudes/common/dto/actualizar-estado-solicitud.dto';

// Mismo mínimo que el resto de rechazos del sistema: el motivo es lo que ve
// el fontanero para saber qué corregir.
export class RechazarSolicitudMaterialDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: 'Debes indicar el motivo del rechazo' })
  @IsString({ message: 'El motivo debe ser texto' })
  @MinLength(MIN_MOTIVO_RECHAZO, {
    message: `El motivo del rechazo debe tener al menos ${MIN_MOTIVO_RECHAZO} caracteres`,
  })
  @MaxLength(500, { message: 'El motivo no puede superar los 500 caracteres' })
  motivoRechazo: string;
}
