import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsIn,
  IsEmail,
} from 'class-validator';

export class CrearProveedorDto {
  @IsNotEmpty({ message: 'El nombre del proveedor es obligatorio' })
  @IsString()
  nombre: string;

  @IsOptional()
  @IsIn(['Físico', 'Jurídico'], {
    message: 'El tipo debe ser "Físico" o "Jurídico"',
  })
  tipo?: string;

  @IsOptional()
  @IsString()
  contacto?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo debe ser una dirección válida' })
  correo?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsIn(['Activo', 'Inactivo'], {
    message: 'El estado debe ser "Activo" o "Inactivo"',
  })
  estado?: string;
}

