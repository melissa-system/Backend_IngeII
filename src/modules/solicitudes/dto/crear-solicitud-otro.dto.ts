import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CrearSolicitudOtroDto {
  // Solo lo usa un administrador que genera la solicitud para otra persona.
  // Si quien crea es un abonado logueado, el id se resuelve desde su token
  // y este campo se ignora. En multipart/form-data viaja como string, por
  // lo que se usa @Type(() => Number) para convertirlo antes de validar.
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El id del abonado debe ser un número entero' })
  @Min(1, { message: 'El id del abonado debe ser un número positivo' })
  idAbonado?: number;

  // Asunto corto del trámite (resumen visible en las tablas). Mínimo de 20
  // caracteres para evitar solicitudes vagas.
  @IsNotEmpty({ message: 'El asunto es obligatorio' })
  @IsString({ message: 'El asunto debe ser texto' })
  @Length(20, 150, {
    message: 'El asunto debe tener entre 20 y 150 caracteres',
  })
  asunto: string;

  // Descripción detallada del trámite solicitado.
  @IsNotEmpty({ message: 'La justificación es obligatoria' })
  @IsString({ message: 'La justificación debe ser texto' })
  @Length(20, 2000, {
    message: 'La justificación debe tener entre 20 y 2000 caracteres',
  })
  justificacion: string;
}