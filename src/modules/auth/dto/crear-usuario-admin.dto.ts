import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CrearUsuarioAdminDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  email: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, {
    message: 'La contraseña no puede superar los 72 caracteres',
  })
  // Mismas reglas de fortaleza que el registro y el cambio de contraseña.
  @Matches(/[A-Z]/, {
    message: 'La contraseña debe incluir al menos una letra mayúscula',
  })
  @Matches(/[0-9]/, {
    message: 'La contraseña debe incluir al menos un número',
  })
  password: string;

  @IsNumber({}, { message: 'El ID de rol debe ser un número válido' })
  @IsPositive({ message: 'Seleccione un rol válido' })
  @IsNotEmpty({ message: 'El rol es obligatorio' })
  role_id: number;
}
