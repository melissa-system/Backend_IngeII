import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TipoActividad } from '../entities/reporte-fontanero.enums';

// Tope de minutos por reporte: 24 horas. Más que eso es casi seguro un error
// de digitación (escribir horas donde van minutos, por ejemplo).
const MAXIMO_MINUTOS = 24 * 60;

export class MaterialUtilizadoDto {
  @Type(() => Number)
  @IsInt({ message: 'El material seleccionado no es válido' })
  articuloId: number;

  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad de cada material debe ser al menos 1' })
  cantidad: number;
}

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

  // Materiales usados. Puede ir vacío: no todo trabajo consume inventario.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30, {
    message: 'No se pueden registrar más de 30 materiales en un mismo reporte',
  })
  @ValidateNested({ each: true })
  @Type(() => MaterialUtilizadoDto)
  materiales?: MaterialUtilizadoDto[];
}
