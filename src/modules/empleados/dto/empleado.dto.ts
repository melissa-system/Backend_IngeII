import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  EsCedula,
  EsCorreo,
  EsFecha,
  EsTelefono,
} from '../../../common/validacion/decoradores-validacion';

// DTOs de la gestión de personal. Antes el body llegaba como un objeto sin
// validar: un campo vacío terminaba en un error 500 de la base de datos.
export class CrearEmpleadoDto {
  @IsString({ message: 'El nombre debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MaxLength(150, { message: 'El nombre no puede superar los 150 caracteres.' })
  nombre: string;

  @IsNotEmpty({ message: 'La cédula es obligatoria.' })
  @EsCedula(['fisica', 'dimex'], {
    message:
      'La cédula debe ser una cédula física (9 dígitos) o un DIMEX (11 o 12 dígitos).',
  })
  cedula: string;

  @IsString({ message: 'El puesto debe ser texto.' })
  @IsNotEmpty({ message: 'El puesto es obligatorio.' })
  @MaxLength(100, { message: 'El puesto no puede superar los 100 caracteres.' })
  puesto: string;

  @IsNotEmpty({ message: 'El teléfono es obligatorio.' })
  @EsTelefono()
  telefono: string;

  @IsNotEmpty({ message: 'La fecha de ingreso es obligatoria.' })
  @EsFecha({ message: 'La fecha de ingreso no es válida.' })
  fecha_ingreso: string;

  @IsOptional()
  @IsInt({ message: 'El usuario seleccionado no es válido.' })
  @IsPositive({ message: 'El usuario seleccionado no es válido.' })
  usuario_id?: number;

  @ValidateIf((o: CrearEmpleadoDto) => !!o.email)
  @EsCorreo()
  @MaxLength(150, { message: 'El correo no puede superar los 150 caracteres.' })
  email?: string;

  @IsOptional()
  @IsBoolean({ message: 'confirmarVinculacion debe ser verdadero o falso.' })
  confirmarVinculacion?: boolean;
}

export class ActualizarEmpleadoDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre no puede quedar vacío.' })
  @MaxLength(150, { message: 'El nombre no puede superar los 150 caracteres.' })
  nombre?: string;

  @IsOptional()
  @EsCedula(['fisica', 'dimex'], {
    message:
      'La cédula debe ser una cédula física (9 dígitos) o un DIMEX (11 o 12 dígitos).',
  })
  cedula?: string;

  @IsOptional()
  @IsString({ message: 'El puesto debe ser texto.' })
  @IsNotEmpty({ message: 'El puesto no puede quedar vacío.' })
  @MaxLength(100, { message: 'El puesto no puede superar los 100 caracteres.' })
  puesto?: string;

  @IsOptional()
  @EsTelefono()
  telefono?: string;

  // null o '' borra el correo; si trae valor debe ser un correo válido.
  @ValidateIf((o: ActualizarEmpleadoDto) => !!o.correo)
  @EsCorreo()
  @MaxLength(150, { message: 'El correo no puede superar los 150 caracteres.' })
  correo?: string | null;

  @IsOptional()
  @EsFecha({ message: 'La fecha de ingreso no es válida.' })
  fecha_ingreso?: string;

  @ValidateIf(
    (o: ActualizarEmpleadoDto) =>
      o.usuario_id !== null && o.usuario_id !== undefined,
  )
  @IsInt({ message: 'El usuario seleccionado no es válido.' })
  @IsPositive({ message: 'El usuario seleccionado no es válido.' })
  usuario_id?: number | null;

  @IsOptional()
  @IsBoolean({ message: 'confirmarVinculacion debe ser verdadero o falso.' })
  confirmarVinculacion?: boolean;
}

export class CambiarEstadoEmpleadoDto {
  @IsIn(['Activo', 'Inactivo'], {
    message: "El estado debe ser 'Activo' o 'Inactivo'.",
  })
  estado: 'Activo' | 'Inactivo';
}
