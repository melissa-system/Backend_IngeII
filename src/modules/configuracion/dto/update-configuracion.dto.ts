import {
  IsString,
  IsOptional,
  IsEmail,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO para actualizar la configuración de la ASADA.
 * Todos los campos son opcionales — solo se actualizan los enviados.
 */
export class UpdateConfiguracionDto {
  // ── Contacto / ubicación ─────────────────────────────────────────

  @IsOptional()
  @IsString({ message: 'La dirección debe ser un texto' })
  @MinLength(1, { message: 'La dirección es obligatoria' })
  @MaxLength(500, { message: 'La dirección no puede exceder 500 caracteres' })
  direccion?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser un texto' })
  @Matches(/^\d{4}-?\d{4}$/, {
    message: 'Formato de teléfono inválido. Use: 0000-0000',
  })
  telefono?: string;

  @IsOptional()
  @IsString({ message: 'El correo debe ser un texto' })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(150, { message: 'El correo no puede exceder 150 caracteres' })
  correo_electronico?: string;

  @IsOptional()
  @IsString({ message: 'El enlace debe ser un texto' })
  @IsUrl({}, { message: 'El enlace debe ser una URL válida (https://...)' })
  @MaxLength(500, { message: 'El enlace no puede exceder 500 caracteres' })
  enlace_google_maps?: string;

  @IsOptional()
  @IsString({ message: 'Las coordenadas deben ser un texto' })
  @MaxLength(100, { message: 'Las coordenadas no pueden exceder 100 caracteres' })
  coordenadas_mapa?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser un texto' })
  @Matches(/^\d{4}-?\d{4}$/, {
    message: 'Formato de teléfono inválido. Use: 0000-0000',
  })
  telefono_miembro_junta_1?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser un texto' })
  @Matches(/^\d{4}-?\d{4}$/, {
    message: 'Formato de teléfono inválido. Use: 0000-0000',
  })
  telefono_miembro_junta_2?: string;

  // ── Horario de atención ──────────────────────────────────────────

  @IsOptional()
  @IsString({ message: 'El horario debe ser un texto' })
  @MaxLength(100, { message: 'El horario no puede exceder 100 caracteres' })
  horario_lunes_viernes?: string;

  @IsOptional()
  @IsString({ message: 'El horario debe ser un texto' })
  @MaxLength(100, { message: 'El horario no puede exceder 100 caracteres' })
  horario_sabado?: string;

  @IsOptional()
  @IsString({ message: 'El horario debe ser un texto' })
  @MaxLength(100, { message: 'El horario no puede exceder 100 caracteres' })
  horario_domingo?: string;
}
