import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';

// Mismas reglas de fortaleza que CambiarPasswordDto: mínimo 8 caracteres,
// al menos una mayúscula y un número.
export class ConfirmarResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'El token es obligatorio' })
  token: string;

  @IsString({ message: 'La nueva contraseña es obligatoria' })
  @MinLength(8, {
    message: 'La nueva contraseña debe tener al menos 8 caracteres',
  })
  @Matches(/[A-Z]/, {
    message: 'La nueva contraseña debe incluir al menos una letra mayúscula',
  })
  @Matches(/[0-9]/, {
    message: 'La nueva contraseña debe incluir al menos un número',
  })
  nuevaPassword: string;
}