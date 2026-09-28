import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

// Mínimo de caracteres del motivo al rechazar. Debe coincidir con MIN_MOTIVO
// del frontend (modal de gestión de estado en las páginas de solicitudes).
export const MIN_MOTIVO_RECHAZO = 10;

// Quita espacios al inicio y al final antes de validar: sin esto, un motivo
// de puros espacios ("          ") pasaría el mínimo de caracteres.
const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ActualizarEstadoSolicitudDto {
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  @IsIn(['pendiente', 'en_proceso', 'aprobado', 'rechazado'], {
    message: 'El estado debe ser pendiente, en_proceso, aprobado o rechazado',
  })
  estado: string;

  // Obligatorio SOLO al rechazar: es la explicación que le llega al abonado
  // por correo. Antes era opcional y lo único que lo exigía era el frontend,
  // así que una llamada directa a la API podía rechazar una solicitud sin
  // ninguna explicación. Al aprobar o marcar en proceso sigue siendo
  // opcional: el @ValidateIf salta todas las reglas en esos casos. OJO: no
  // agregar @IsOptional() acá, porque saltaría la validación justo cuando el
  // motivo viene vacío, que es el caso que se quiere rechazar.
  @Transform(recortar)
  @ValidateIf((o: ActualizarEstadoSolicitudDto) => o.estado === 'rechazado')
  @IsNotEmpty({ message: 'Debes indicar el motivo del rechazo' })
  @IsString({ message: 'El motivo debe ser texto' })
  @MinLength(MIN_MOTIVO_RECHAZO, {
    message: `El motivo del rechazo debe tener al menos ${MIN_MOTIVO_RECHAZO} caracteres`,
  })
  motivoRechazo?: string;
}
