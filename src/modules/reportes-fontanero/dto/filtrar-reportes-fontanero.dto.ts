import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import {
  EstadoRevisionReporte,
  OrigenReporte,
  TipoActividad,
} from '../entities/reporte-fontanero.enums';

export class FiltrarReportesFontaneroDto {
  // Id del EMPLEADO fontanero (no el del usuario).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  empleadoId?: number;

  @IsOptional()
  @IsEnum(TipoActividad, {
    message: `El tipo de actividad debe ser uno de: ${Object.values(TipoActividad).join(', ')}`,
  })
  tipoActividad?: TipoActividad;

  @IsOptional()
  @IsEnum(EstadoRevisionReporte, {
    message: `El estado de revisión debe ser uno de: ${Object.values(EstadoRevisionReporte).join(', ')}`,
  })
  estadoRevision?: EstadoRevisionReporte;

  // 'asignado' = viene de una avería/labor; 'no_asignado' = reporte suelto.
  @IsOptional()
  @IsEnum(OrigenReporte, {
    message: `El origen debe ser uno de: ${Object.values(OrigenReporte).join(', ')}`,
  })
  origen?: OrigenReporte;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha "desde" debe tener formato YYYY-MM-DD' })
  desde?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha "hasta" debe tener formato YYYY-MM-DD' })
  hasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limite?: number;
}
