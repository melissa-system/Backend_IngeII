import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ItemSolicitudMaterialDto {
  // Material del catálogo. Opcional: el fontanero también puede pedir algo
  // que no está en inventario usando descripcionLibre.
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El material seleccionado no es válido' })
  @Min(1, { message: 'El material seleccionado no es válido' })
  articuloId?: number;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La descripción del material debe ser texto' })
  @MinLength(3, { message: 'Describe el material con al menos 3 caracteres' })
  @MaxLength(150, { message: 'La descripción no puede superar los 150 caracteres' })
  descripcionLibre?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La unidad debe ser texto' })
  @MaxLength(30, { message: 'La unidad no puede superar los 30 caracteres' })
  unidad?: string;

  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser al menos 1' })
  @Max(999, { message: 'La cantidad no puede superar 999' })
  cantidad: number;
}

export class CrearSolicitudMaterialDto {
  // Avería o labor a la que pertenece el pedido. Se valida en el servicio
  // que venga exactamente una de las dos y que esté asignada al fontanero.
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La avería seleccionada no es válida' })
  @Min(1, { message: 'La avería seleccionada no es válida' })
  averiaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La labor seleccionada no es válida' })
  @Min(1, { message: 'La labor seleccionada no es válida' })
  laborId?: number;

  // Justificación del pedido; la lee la administración al aprobarlo.
  @Transform(recortar)
  @IsString({ message: 'El motivo debe ser texto' })
  @MinLength(10, { message: 'Explica el motivo con al menos 10 caracteres' })
  @MaxLength(500, { message: 'El motivo no puede superar los 500 caracteres' })
  motivo: string;

  @IsArray({ message: 'Debes agregar al menos un material' })
  @ArrayMinSize(1, { message: 'Debes agregar al menos un material' })
  @ValidateNested({ each: true })
  @Type(() => ItemSolicitudMaterialDto)
  items: ItemSolicitudMaterialDto[];
}

export class VincularMaterialDto {
  @Type(() => Number)
  @IsInt({ message: 'El artículo seleccionado no es válido' })
  @Min(1, { message: 'El artículo seleccionado no es válido' })
  articuloId: number;
}
