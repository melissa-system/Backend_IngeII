import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TipoActividad } from '../entities/reporte-fontanero.enums';

// Tope de minutos por reporte: 24 horas. Más que eso es casi seguro un error
// de digitación (escribir horas donde van minutos, por ejemplo).
const MAXIMO_MINUTOS = 24 * 60;

const MAXIMO_LARGO_MATERIALES = 500;

export class CrearReporteFontaneroDto {
  @IsEnum(TipoActividad, {
    message: `El tipo de actividad debe ser uno de: ${Object.values(TipoActividad).join(', ')}`,
  })
  tipoActividad: TipoActividad;

  @IsString()
  @MinLength(10, {
    message: 'Describe el trabajo realizado con al menos 10 caracteres',
  })
  descripcion: string;

  @IsDateString({}, { message: 'La fecha del trabajo debe tener formato YYYY-MM-DD' })
  fechaTrabajo: string;

  @Type(() => Number)
  @IsInt({ message: 'El tiempo empleado debe ser un número entero de minutos' })
  @Min(1, { message: 'El tiempo empleado debe ser mayor a cero' })
  @Max(MAXIMO_MINUTOS, {
    message: 'El tiempo empleado no puede superar 24 horas (1440 minutos)',
  })
  tiempoMinutos: number;

  // Avería que originó el trabajo. Opcional: hay actividades que no vienen de
  // una avería reportada.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  averiaId?: number;

  // Materiales utilizados, en texto libre. Opcional: no todo trabajo consume
  // material. Podría ser "" si el cliente manda el campo vacío.
  @IsOptional()
  @IsString()
  @MaxLength(MAXIMO_LARGO_MATERIALES, {
    message: `La lista de materiales no puede superar ${MAXIMO_LARGO_MATERIALES} caracteres`,
  })
  materialesTexto?: string;
}
