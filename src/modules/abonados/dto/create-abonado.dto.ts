import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  EsCedula,
  EsCorreo,
  EsTelefono,
} from '../../../common/validacion/decoradores-validacion';

// Las reglas de formato (cédula, teléfono, correo) son las comunes del
// sistema; la coherencia cédula ↔ tipo de abonado (física o jurídica) se
// revisa en AbonadosService.validarDatosAbonado.
export class CreateAbonadoDto {
  @IsIn(['Física', 'Jurídica'], {
    message: "El tipo de abonado debe ser 'Física' o 'Jurídica'.",
  })
  tipo_abonado: string;

  // Nombre de pila (física) o razón social (jurídica).
  @IsString({ message: 'El nombre debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MaxLength(150, { message: 'El nombre no puede superar los 150 caracteres.' })
  nombre: string;

  // Solo física (van a abonados_fisicos)
  @IsOptional()
  @IsString({ message: 'El primer apellido debe ser texto.' })
  @MaxLength(100, {
    message: 'El primer apellido no puede superar los 100 caracteres.',
  })
  apellido1?: string;

  @IsOptional()
  @IsString({ message: 'El segundo apellido debe ser texto.' })
  @MaxLength(100, {
    message: 'El segundo apellido no puede superar los 100 caracteres.',
  })
  apellido2?: string;

  @IsOptional()
  @IsString({ message: 'El número de plano catastrado debe ser texto.' })
  @MaxLength(50, {
    message:
      'El número de plano catastrado no puede superar los 50 caracteres.',
  })
  numero_plano_catastrado?: string;

  // Solo jurídica (van a abonados_juridicos)
  @IsOptional()
  @IsString({ message: 'El nombre del representante legal debe ser texto.' })
  @MaxLength(150, {
    message:
      'El nombre del representante legal no puede superar los 150 caracteres.',
  })
  nombre_representante_legal?: string;

  @IsOptional()
  @EsCedula(['fisica', 'dimex'], {
    message:
      'La cédula del representante legal debe ser una cédula física (9 dígitos) o un DIMEX (11 o 12 dígitos).',
  })
  cedula_representante?: string;

  // Cédula física o cédula jurídica.
  @IsNotEmpty({ message: 'La cédula es obligatoria.' })
  @EsCedula()
  cedula: string;

  @IsNotEmpty({ message: 'El teléfono es obligatorio.' })
  @EsTelefono()
  telefono: string;

  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  @EsCorreo()
  @MaxLength(150, { message: 'El correo no puede superar los 150 caracteres.' })
  correo: string;

  @IsString({ message: 'La dirección debe ser texto.' })
  @IsNotEmpty({ message: 'La dirección es obligatoria.' })
  @MaxLength(255, {
    message: 'La dirección no puede superar los 255 caracteres.',
  })
  direccion: string;

  // Confirma explícitamente que se quiere registrar como abonado a alguien
  // cuya cédula ya existe como empleado (ej. un miembro de la Junta que
  // también es abonado). Sin este flag, esa combinación se rechaza para
  // evitar duplicados accidentales; con él, se permite (ver
  // AbonadosService.verificarCedulaNoUsadaPorEmpleado).
  @IsOptional()
  @IsBoolean({ message: 'confirmarVinculacion debe ser verdadero o falso.' })
  confirmarVinculacion?: boolean;
}
