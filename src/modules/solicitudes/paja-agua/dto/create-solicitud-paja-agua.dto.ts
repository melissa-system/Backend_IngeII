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

// Opciones válidas para los selects del formulario (Sección III y IV del
// formulario GNU-42-01-F1 de AyA, adaptado). Se validan acá también (no
// solo en el <select> del frontend) porque cualquiera puede mandar un POST
// directo sin pasar por la interfaz.
export const NATURALEZA_INMUEBLE_OPCIONES = [
  'Inmueble inscrito',
  'Parcela agrícola',
  'Zona indígena',
  'Zona marítimo terrestre',
  'Terreno en administración del INDER',
  'Inmueble sin inscribir',
] as const;

export const CALIDAD_TITULAR_OPCIONES = [
  'Propietario registral',
  'Poseedor',
  'Autorizado legal',
  'Representante legal',
  'Concesionario, arrendatario o asignatario',
] as const;

export const TIPO_SERVICIO_OPCIONES = [
  'Agua potable',
  'Alcantarillado sanitario',
  'Agua potable y alcantarillado sanitario',
] as const;

export const TIPO_CONEXION_OPCIONES = [
  'Nueva conexión',
  'Individualización',
  'Independización',
  'Traslado de acometida',
  'Cambio de diámetro',
  'Servicio provisional para proyectos',
  'Servicio temporal',
] as const;

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

  @IsOptional()
  @ValidateIf((o) => o.telefonoSecundario !== '')
  @Matches(TELEFONO_REGEX, {
    message: 'Formato de teléfono inválido. Usa el formato 8888-8888',
  })
  telefonoSecundario?: string;

  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  correo: string;

  @IsNotEmpty({ message: 'La provincia es obligatoria' })
  @IsString()
  provincia: string;

  @IsNotEmpty({ message: 'El cantón es obligatorio' })
  @IsString()
  canton: string;

  @IsNotEmpty({ message: 'El distrito es obligatorio' })
  @IsString()
  distrito: string;

  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  @IsString()
  direccion: string;

  @IsNotEmpty({ message: 'El número de plano es obligatorio' })
  @IsString()
  numeroPlano: string;

  @IsNotEmpty({ message: 'La naturaleza del inmueble es obligatoria' })
  @IsIn(NATURALEZA_INMUEBLE_OPCIONES, {
    message: 'Selecciona una naturaleza de inmueble válida',
  })
  naturalezaInmueble: string;

  @IsNotEmpty({ message: 'La calidad del titular es obligatoria' })
  @IsIn(CALIDAD_TITULAR_OPCIONES, {
    message: 'Selecciona una calidad de titular válida',
  })
  calidadTitular: string;

  @IsNotEmpty({ message: 'El tipo de servicio es obligatorio' })
  @IsIn(TIPO_SERVICIO_OPCIONES, {
    message: 'Selecciona un tipo de servicio válido',
  })
  tipoServicio: string;

  @IsNotEmpty({ message: 'El tipo de conexión es obligatorio' })
  @IsIn(TIPO_CONEXION_OPCIONES, {
    message: 'Selecciona un tipo de conexión válido',
  })
  tipoConexion: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
