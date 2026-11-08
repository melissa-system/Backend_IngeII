import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsIn,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  EsCorreo,
  EsTelefono,
} from '../../../common/validacion/decoradores-validacion';

// Los campos opcionales pueden llegar vacíos desde el formulario; solo se
// valida su formato cuando traen un valor.
export class CrearProveedorDto {
  @IsNotEmpty({ message: 'El nombre del proveedor es obligatorio' })
  @IsString({ message: 'El nombre del proveedor debe ser texto.' })
  @MaxLength(200, {
    message: 'El nombre del proveedor no puede superar los 200 caracteres.',
  })
  nombre: string;

  @IsOptional()
  @IsIn(['Físico', 'Jurídico'], {
    message: 'El tipo debe ser "Físico" o "Jurídico"',
  })
  tipo?: string;

  @IsOptional()
  @IsString({ message: 'El contacto debe ser texto.' })
  @MaxLength(150, {
    message: 'El contacto no puede superar los 150 caracteres.',
  })
  contacto?: string;

  @ValidateIf((o: CrearProveedorDto) => !!o.telefono)
  @EsTelefono()
  telefono?: string;

  @ValidateIf((o: CrearProveedorDto) => !!o.correo)
  @EsCorreo()
  @MaxLength(150, { message: 'El correo no puede superar los 150 caracteres.' })
  correo?: string;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser texto.' })
  @MaxLength(255, {
    message: 'La dirección no puede superar los 255 caracteres.',
  })
  direccion?: string;

  @IsOptional()
  @IsIn(['Activo', 'Inactivo'], {
    message: 'El estado debe ser "Activo" o "Inactivo"',
  })
  estado?: string;
}
