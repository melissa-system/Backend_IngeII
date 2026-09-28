import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateAveriaDto {
  @IsString()
  @IsNotEmpty()
  tipo_averia: string;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsString()
  @IsNotEmpty()
  cedula_reportante: string;

  @IsString()
  @IsNotEmpty()
  nombre_reportante: string;

  @IsString()
  @IsOptional()
  apellido1_reportante?: string;

  @IsString()
  @IsOptional()
  apellido2_reportante?: string;

  @IsString()
  @IsOptional()
  ubicacion?: string;
}
