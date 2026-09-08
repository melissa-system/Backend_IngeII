import { IsString, IsOptional, Matches, MaxLength } from 'class-validator';

/**
 * DTO para actualizar los datos del perfil del usuario autenticado.
 * Solo email y teléfono son editables desde el perfil.
 */
export class ActualizarPerfilDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-?\d{4}$/, {
    message: 'Formato de teléfono inválido. Use: 0000-0000',
  })
  telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,30}$/, {
    message:
      'El nombre de usuario debe tener entre 3 y 30 caracteres (letras, números, ".", "_" o "-", sin espacios)',
  })
  username?: string;
}
