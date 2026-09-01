import { IsEmail, IsNotEmpty, IsNumber, IsString, MinLength } from 'class-validator';

export class CrearUsuarioAdminDto {
    @IsEmail({}, { message: 'El correo electrónico no es válido' })
    @IsNotEmpty({ message: 'El correo es obligatorio' })
    email: string;

    @IsString({ message: 'La contraseña debe ser una cadena de texto' })
    @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    password: string;

    @IsNumber({}, { message: 'El ID de rol debe ser un número válido' })
    @IsNotEmpty({ message: 'El rol es obligatorio' })
    role_id: number;
}