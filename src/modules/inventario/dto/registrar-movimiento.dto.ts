import {
  IsNotEmpty,
  IsString,
  IsIn,
  IsInt,
  Min,
  ValidateIf,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RegistrarMovimientoDto {
  @IsIn(['entrada', 'salida'], {
    message: 'El tipo de movimiento debe ser "entrada" o "salida"',
  })
  tipoMovimiento: 'entrada' | 'salida';

  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser mayor a 0' })
  cantidad: number;

  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @IsString()
  motivo: string;

  @ValidateIf((o) => o.tipoMovimiento === 'salida')
  @IsNotEmpty({ message: 'El responsable o destino es obligatorio en salidas' })
  @IsString({ message: 'El responsable o destino debe ser una cadena de texto' })
  responsableDestino?: string;
}

