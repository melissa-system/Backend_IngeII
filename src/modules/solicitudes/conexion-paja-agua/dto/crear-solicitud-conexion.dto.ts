import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ValidateBy } from 'class-validator';
import { EsCedula } from '../../../../common/validacion/decoradores-validacion';
import { esCorreo } from '../../../../common/validacion/reglas-validacion';

// Si el medio de notificación elegido es el correo, el valor debe ser un
// correo válido (para fax o dirección basta con que no venga vacío).
function CorreoSiElMedioEsCorreo(campoMedio: string): PropertyDecorator {
  return ValidateBy({
    name: 'correoSiElMedioEsCorreo',
    validator: {
      validate: (valor: unknown, args) =>
        (args?.object as Record<string, unknown>)[campoMedio] !== 'correo' ||
        esCorreo(valor),
      defaultMessage: () =>
        'El correo de notificación no tiene un formato válido.',
    },
  });
}

const MEDIOS_NOTIFICACION = ['fax', 'correo', 'direccion'] as const;
const SERVICIOS = [
  'agua_potable',
  'alcantarillado_sanitario',
  'ambos',
] as const;
const TIPOS_TRAMITE = [
  'nueva_conexion',
  'individualizacion',
  'independizacion',
  'traslado',
  'servicio_provisional_proyectos',
  'cambio_diametro',
  'servicio_temporal',
] as const;
const FORMAS_PAGO = ['efectivo_previo', 'incluir_primera_facturacion'] as const;

// Metadatos de cada adjunto (tipo interno + etiqueta legible), en el mismo
// orden en que llegan los archivos en el campo 'adjuntos' del multipart. Se
// manda como un string JSON porque multipart/form-data no soporta arrays de
// objetos directamente.
export class AdjuntoMetaDto {
  tipo: string;
  etiqueta: string;
}

export class CrearSolicitudConexionDto {
  // Solo lo usa un administrador que gestiona la solicitud en nombre de un
  // abonado con más de una solicitud de paja de agua aprobada sin conexión
  // aún. Si quien crea es el propio abonado y solo tiene una disponible, se
  // resuelve automáticamente en el service.
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'El id de la solicitud de paja de agua debe ser un número entero',
  })
  @Min(1)
  idSolicitudPajaAgua?: number;

  @IsNotEmpty({ message: 'El medio de notificación principal es obligatorio' })
  @IsIn(MEDIOS_NOTIFICACION, { message: 'Medio de notificación no válido' })
  medioNotificacionPrincipal: string;

  @IsNotEmpty({
    message: 'El valor del medio de notificación principal es obligatorio',
  })
  @IsString({ message: 'El valor del medio de notificación debe ser texto.' })
  @MaxLength(255, {
    message:
      'El valor del medio de notificación no puede superar los 255 caracteres.',
  })
  @CorreoSiElMedioEsCorreo('medioNotificacionPrincipal')
  valorNotificacionPrincipal: string;

  @IsOptional()
  @IsIn(MEDIOS_NOTIFICACION, { message: 'Medio de notificación no válido' })
  medioNotificacionSecundario?: string;

  @ValidateIf((o: CrearSolicitudConexionDto) => !!o.medioNotificacionSecundario)
  @IsNotEmpty({
    message: 'El valor del medio de notificación secundario es obligatorio',
  })
  @IsString()
  valorNotificacionSecundario?: string;

  @IsOptional()
  @IsString()
  folioReal?: string;

  @IsOptional()
  @IsString()
  planoCatastro?: string;

  @IsOptional()
  @IsString()
  planoAgrimensura?: string;

  @IsNotEmpty({ message: 'El número de disponibilidad es obligatorio' })
  @IsString()
  numeroDisponibilidad: string;

  @IsOptional()
  @IsString()
  numeroNis?: string;

  @IsNotEmpty({ message: 'El servicio solicitado es obligatorio' })
  @IsIn(SERVICIOS, { message: 'Servicio solicitado no válido' })
  servicioSolicitado: string;

  @IsNotEmpty({ message: 'El tipo de trámite es obligatorio' })
  @IsIn(TIPOS_TRAMITE, { message: 'Tipo de trámite no válido' })
  tipoTramite: string;

  @IsOptional()
  @IsString()
  codigoApcCfia?: string;

  @IsNotEmpty({ message: 'La forma de pago es obligatoria' })
  @IsIn(FORMAS_PAGO, { message: 'Forma de pago no válida' })
  formaPago: string;

  @IsNotEmpty({ message: 'El nombre del firmante es obligatorio' })
  @IsString({ message: 'El nombre del firmante debe ser texto.' })
  @MaxLength(150, {
    message: 'El nombre del firmante no puede superar los 150 caracteres.',
  })
  nombreFirmante: string;

  @IsNotEmpty({ message: 'La identificación del firmante es obligatoria' })
  @EsCedula()
  identificacionFirmante: string;

  // JSON.stringify(AdjuntoMetaDto[]), en el mismo orden que los archivos del
  // campo 'adjuntos'. Se valida y parsea en el controller/service.
  @IsOptional()
  @IsString()
  adjuntosMeta?: string;
}
