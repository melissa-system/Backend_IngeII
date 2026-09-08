import { IsIn } from 'class-validator';

// Únicos valores permitidos por el ENUM de la columna 'estado' en MySQL.
export const ESTADOS_ABONADO = ['Activo', 'Inactivo'];

// Cuerpo esperado por PATCH /abonados/:id/estado.
export class CambiarEstadoAbonadoDto {
  @IsIn(ESTADOS_ABONADO, {
    message: 'El estado debe ser Activo o Inactivo',
  })
  estado!: string;
}
