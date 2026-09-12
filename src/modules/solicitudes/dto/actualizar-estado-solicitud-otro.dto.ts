import { ValidateIf } from 'class-validator';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Length,
} from 'class-validator';

// Cambio de estado de una solicitud "otro". A diferencia de las demás
// solicitudes, el comentario del administrador es OBLIGATORIO al aprobar o
// rechazar: como este tipo no actualiza nada del abonado, la resolución queda
// documentada solo con esa nota (y se envía al solicitante por correo).
export class ActualizarEstadoSolicitudOtroDto {
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  @IsIn(['pendiente', 'en_proceso', 'aprobado', 'rechazado'], {
    message: 'El estado debe ser pendiente, en_proceso, aprobado o rechazado',
  })
  estado: string;

  @ValidateIf((o) => o.estado === 'aprobado' || o.estado === 'rechazado')
  @IsNotEmpty({ message: 'Debes dejar un comentario sobre la resolución' })
  @IsString({ message: 'El comentario debe ser texto' })
  @Length(3, 2000, {
    message: 'El comentario debe tener entre 3 y 2000 caracteres',
  })
  motivoRechazo?: string;
}