import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';
import { MIN_MOTIVO_RECHAZO } from '../../common/dto/actualizar-estado-solicitud.dto';

// Quita espacios al inicio y al final antes de validar: sin esto, un
// comentario de puros espacios pasaría el mínimo de caracteres.
const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Cambio de estado de una solicitud "otro". A diferencia de las demás
// solicitudes, el comentario del administrador es OBLIGATORIO al aprobar o
// rechazar: como este tipo no actualiza nada del abonado, la resolución queda
// documentada solo con esa nota (y se envía al solicitante por correo).
//
// El mínimo es el mismo de las demás solicitudes y del frontend (antes era
// 3 acá y 10 en la pantalla, así que la API aceptaba lo que la pantalla no).
export class ActualizarEstadoSolicitudOtroDto {
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  @IsIn(['pendiente', 'en_proceso', 'aprobado', 'rechazado'], {
    message: 'El estado debe ser pendiente, en_proceso, aprobado o rechazado',
  })
  estado: string;

  @Transform(recortar)
  @ValidateIf(
    (o: ActualizarEstadoSolicitudOtroDto) =>
      o.estado === 'aprobado' || o.estado === 'rechazado',
  )
  @IsNotEmpty({ message: 'Debes dejar un comentario sobre la resolución' })
  @IsString({ message: 'El comentario debe ser texto' })
  @Length(MIN_MOTIVO_RECHAZO, 2000, {
    message: `El comentario debe tener entre ${MIN_MOTIVO_RECHAZO} y 2000 caracteres`,
  })
  motivoRechazo?: string;
}