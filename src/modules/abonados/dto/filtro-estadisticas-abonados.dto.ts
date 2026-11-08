import { IsOptional, IsDateString, IsString } from 'class-validator';

export class FiltroEstadisticasAbonadosDto {
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  estado?: string;
}
