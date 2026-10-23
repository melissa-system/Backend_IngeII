import {
  IsString,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';

export class UpdateAveriaDto {
  // "En proceso" no se acepta: lo asigna el sistema al asignar el fontanero.
  @IsOptional()
  @IsIn(['Pendiente', 'Finalizado'], {
    message:
      'El estado debe ser Pendiente o Finalizado. "En proceso" se asigna automáticamente al asignar un fontanero.',
  })
  estado?: string;

  @IsOptional()
  @IsInt({ message: 'El fontanero seleccionado no es válido.' })
  @Min(1, { message: 'El fontanero seleccionado no es válido.' })
  empleado_id?: number;

  @IsOptional()
  @IsString({ message: 'La observación debe ser texto.' })
  @MaxLength(1000, {
    message: 'La observación no puede superar los 1000 caracteres.',
  })
  observacion?: string;

  // Solo se usa como texto visible en la bitácora; quién hizo el cambio se
  // toma del usuario autenticado (no del cuerpo de la petición).
  @IsOptional()
  @IsString({ message: 'realizado_por debe ser texto.' })
  @MaxLength(255, {
    message: 'realizado_por no puede superar los 255 caracteres.',
  })
  realizado_por?: string;
}
