import { IsEmail, IsNotEmpty } from 'class-validator';

export class SolicitarResetPasswordDto {
  @IsEmail({}, { message: 'Debe ser un correo electrónico válido' })
  @IsNotEmpty()
  email: string;
}