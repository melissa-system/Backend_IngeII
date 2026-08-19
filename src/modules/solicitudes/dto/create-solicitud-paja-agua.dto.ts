import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

// Formatos de identificación válidos en Costa Rica:
//   Cédula física:   1-2345-6789
//   Cédula jurídica: 3-101-123456 (1-3-6 dígitos)
//   DIMEX:           11 o 12 dígitos
const IDENTIFICACION_REGEX = /^(\d{1}-\d{4}-\d{4}|\d{1}-\d{3}-\d{6}|\d{11,12})$/;
const TELEFONO_REGEX = /^\d{4}-?\d{4}$/;

export class CreateSolicitudPajaAguaDto {
  @IsOptional()
  @IsString()
  codigoSolicitud?: string;

  @IsNotEmpty({ message: 'El tipo de persona es obligatorio' })
  @IsIn(['fisica', 'juridica'], {
    message: 'El tipo de persona debe ser "fisica" o "juridica"',
  })
  tipoPersona: string;

  @IsNotEmpty({ message: 'El nombre del solicitante es obligatorio' })
  @IsString()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  nombreSolicitante: string;

  @IsNotEmpty({ message: 'La identificación es obligatoria' })
  @Matches(IDENTIFICACION_REGEX, {
    message:
      'Formato de identificación inválido. Usa cédula (1-2345-6789), cédula jurídica (3-101-123456) o DIMEX (11-12 dígitos)',
  })
  identificacion: string;

  @ValidateIf((o) => o.tipoPersona === 'juridica')
  @IsNotEmpty({
    message: 'El nombre del representante es obligatorio para persona jurídica',
  })
  nombreRepresentante?: string;

  @ValidateIf((o) => o.tipoPersona === 'juridica')
  @IsNotEmpty({
    message: 'La cédula del representante es obligatoria para persona jurídica',
  })
  @Matches(IDENTIFICACION_REGEX, {
    message: 'Formato de cédula del representante inválido',
  })
  cedulaRepresentante?: string;

  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @Matches(TELEFONO_REGEX, {
    message: 'Formato de teléfono inválido. Usa el formato 8888-8888',
  })
  telefono: string;

  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  correo: string;

  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  @IsString()
  direccion: string;

  @IsNotEmpty({ message: 'El número de plano es obligatorio' })
  @IsString()
  numeroPlano: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
