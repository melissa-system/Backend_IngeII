import { IsString, Matches, MinLength } from 'class-validator';

// Reglas de fortaleza para contraseñas nuevas: mínimo 8 caracteres, al menos
// una mayúscula y un número. El ValidationPipe global ejecuta estas reglas
// antes de llegar al controlador; los mensajes son los que verá el usuario.
export class CambiarPasswordDto {
  @IsString({ message: 'La contraseña actual es obligatoria' })
  passwordActual: string;

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
