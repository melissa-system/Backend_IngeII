import { IsOptional, IsDateString, IsString } from 'class-validator';

export class FiltroEstadisticasSolicitudesDto {
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
