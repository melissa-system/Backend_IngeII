import { IsBoolean } from 'class-validator';

export class CambiarEstadoUsuarioDto {
  @IsBoolean()
  isActive: boolean;
}
