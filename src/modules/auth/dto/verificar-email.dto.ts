import { IsString, IsNotEmpty } from 'class-validator';

export class VerificarEmailDto {
  @IsString()
  @IsNotEmpty({ message: 'El token es obligatorio' })
  token: string;
}