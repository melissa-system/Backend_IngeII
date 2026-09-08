import { IsIn } from 'class-validator';

/**
 * DTO para POST /auth/cambiar-perfil (selector de perfil del frontend).
 * El vínculo real (Abonado/Empleado) se verifica en AuthService, nunca se
 * confía en más que el destino pedido.
 */
export class CambiarPerfilDto {
  @IsIn(['base', 'abonado', 'empleado'])
  perfil: 'base' | 'abonado' | 'empleado';
}
