import { IsInt, IsPositive } from 'class-validator';

export class CambiarRolUsuarioDto {
  @IsInt()
  @IsPositive()
  role_id: number;
}
