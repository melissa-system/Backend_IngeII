import { IsString, IsOptional, IsNumber } from 'class-validator';

export class UpdateAveriaDto {
  @IsString()
  @IsOptional()
  estado?: string;

  @IsNumber()
  @IsOptional()
  empleado_id?: number;

  @IsString()
  @IsOptional()
  observacion?: string;

  @IsString()
  @IsOptional()
  realizado_por?: string;
}
