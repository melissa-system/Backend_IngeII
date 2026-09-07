import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class ActualizarEstadoSolicitudDto {
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  @IsIn(['pendiente', 'en_proceso', 'aprobado', 'rechazado'], {
    message: 'El estado debe ser pendiente, en_proceso, aprobado o rechazado',
  })
  estado: string;

  // Comentario opcional del administrador; se incluye en el correo de
  // notificación cuando la solicitud se rechaza.
  @IsOptional()
  @IsString()
  motivoRechazo?: string;
}