import { IsOptional, IsEnum, IsInt, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ModuloBitacora, AccionBitacora } from '../entities/bitacora.enums';

export class FiltrarBitacoraDto {
  @IsOptional()
  @IsEnum(ModuloBitacora, {
    message: `El módulo debe ser uno de: ${Object.values(ModuloBitacora).join(', ')}`,
  })
  modulo?: ModuloBitacora;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  registro_id?: number;

  @IsOptional()
  @IsEnum(AccionBitacora, {
    message: `La acción debe ser una de: ${Object.values(AccionBitacora).join(', ')}`,
  })
  accion?: AccionBitacora;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  usuario_id?: number;

  // Formato ISO (YYYY-MM-DD). 'desde' incluye todo el día; 'hasta' también
  // (ver el ajuste de hora en BitacoraService.buscar).
  @IsOptional()
  @IsDateString({}, { message: 'La fecha "desde" debe tener formato YYYY-MM-DD' })
  desde?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha "hasta" debe tener formato YYYY-MM-DD' })
  hasta?: string;

  // Paginación: la bitácora crece rápido (cada edición de campo es una fila),
  // así que nunca se devuelve completa.
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