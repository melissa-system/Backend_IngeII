import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

// Mismo mínimo que las demás solicitudes (ver
// solicitudes/common/dto/actualizar-estado-solicitud.dto.ts) — debe
// coincidir con MIN_MOTIVO del modal de gestión en el frontend.
export const MIN_MOTIVO_RECHAZO_PAJA_AGUA = 10;

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Cambio de estado de la solicitud pública de paja de agua. A diferencia de
// las demás solicitudes (que usan minúsculas: pendiente/en_proceso/...),
// esta tabla ya usaba 'Pendiente'/'Aprobada'/'Rechazada' desde antes de
// tener gestión de estado, así que se mantiene esa capitalización para no
// romper los datos existentes.
export class ActualizarEstadoSolicitudPajaAguaDto {
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  @IsIn(['En proceso', 'Aprobada', 'Rechazada'], {
    message: 'El estado debe ser "En proceso", "Aprobada" o "Rechazada"',
  })
  estado: string;

  // Obligatorio SOLO al rechazar (ver ValidateIf) — es la explicación que le
  // llega al solicitante por correo.
  @Transform(recortar)
  @ValidateIf((o: ActualizarEstadoSolicitudPajaAguaDto) => o.estado === 'Rechazada')
  @IsNotEmpty({ message: 'Debes indicar el motivo del rechazo' })
  @IsString({ message: 'El motivo debe ser texto' })
  @MinLength(MIN_MOTIVO_RECHAZO_PAJA_AGUA, {
    message: `El motivo del rechazo debe tener al menos ${MIN_MOTIVO_RECHAZO_PAJA_AGUA} caracteres`,
  })
  motivoRechazo?: string;
}
