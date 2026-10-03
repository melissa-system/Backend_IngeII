import {
  BadRequestException,
  HttpStatus,
  ValidationError,
} from '@nestjs/common';

// Formato único de las respuestas de error de la API (PBI 511 / Task 516).
// Todos los endpoints responden así, sin importar de dónde salga el error:
//
//   {
//     "statusCode": 400,
//     "codigo": "DATOS_INVALIDOS",
//     "message": "Revise los datos marcados en el formulario.",
//     "errores": [{ "campo": "cedula", "mensaje": "La cédula ..." }]
//   }
//
// - message: siempre un texto en español, listo para mostrarse.
// - errores: un elemento por campo inválido (vacío si el error no es de un
//   campo concreto), para que el frontend lo muestre junto al campo.
// - Algunos errores agregan datos propios (ej. requiereConfirmacion en el
//   conflicto de cédula abonado/empleado); se conservan tal cual.

export interface ErrorDeCampo {
  campo: string;
  mensaje: string;
}

export interface RespuestaError {
  statusCode: number;
  codigo: string;
  message: string;
  errores: ErrorDeCampo[];
  [extra: string]: unknown;
}

export const CODIGOS_ERROR: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'DATOS_INVALIDOS',
  [HttpStatus.UNAUTHORIZED]: 'NO_AUTENTICADO',
  [HttpStatus.FORBIDDEN]: 'SIN_PERMISO',
  [HttpStatus.NOT_FOUND]: 'NO_ENCONTRADO',
  [HttpStatus.CONFLICT]: 'DUPLICADO',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'ARCHIVO_DEMASIADO_GRANDE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'DEMASIADOS_INTENTOS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'ERROR_INTERNO',
};

// Mensaje general cuando el error no trae uno propio.
export const MENSAJES_POR_ESTADO: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Revise los datos marcados en el formulario.',
  [HttpStatus.UNAUTHORIZED]: 'Debe iniciar sesión para continuar.',
  [HttpStatus.FORBIDDEN]: 'No tiene permiso para realizar esta acción.',
  [HttpStatus.NOT_FOUND]: 'No se encontró el recurso solicitado.',
  [HttpStatus.CONFLICT]: 'El registro ya existe.',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'El archivo supera el tamaño permitido.',
  [HttpStatus.TOO_MANY_REQUESTS]:
    'Demasiados intentos. Espere un momento e inténtelo de nuevo.',
  [HttpStatus.INTERNAL_SERVER_ERROR]:
    'Ocurrió un error inesperado. Inténtelo de nuevo más tarde.',
};

// Mensajes en inglés que generan Nest, multer o el throttler y que el
// usuario nunca debería ver.
export const TRADUCCIONES: Record<string, string> = {
  'File too large': 'El archivo supera el tamaño permitido.',
  'Unexpected field': 'Se envió un archivo en un campo no esperado.',
  'Too many files': 'Se enviaron demasiados archivos.',
  'Too many parts': 'La solicitud tiene demasiadas partes.',
  'ThrottlerException: Too Many Requests':
    MENSAJES_POR_ESTADO[HttpStatus.TOO_MANY_REQUESTS],
  Unauthorized: MENSAJES_POR_ESTADO[HttpStatus.UNAUTHORIZED],
  Forbidden: MENSAJES_POR_ESTADO[HttpStatus.FORBIDDEN],
  'Forbidden resource': MENSAJES_POR_ESTADO[HttpStatus.FORBIDDEN],
  'Not Found': MENSAJES_POR_ESTADO[HttpStatus.NOT_FOUND],
  'Bad Request': MENSAJES_POR_ESTADO[HttpStatus.BAD_REQUEST],
  'Internal server error':
    MENSAJES_POR_ESTADO[HttpStatus.INTERNAL_SERVER_ERROR],
};

// Mensajes en español para los validadores de class-validator que se usen
// sin mensaje propio (por defecto vienen en inglés).
const MENSAJES_VALIDADOR: Record<string, (campo: string) => string> = {
  isNotEmpty: (c) => `El campo ${c} es obligatorio.`,
  isDefined: (c) => `El campo ${c} es obligatorio.`,
  isString: (c) => `El campo ${c} debe ser texto.`,
  isInt: (c) => `El campo ${c} debe ser un número entero.`,
  isNumber: (c) => `El campo ${c} debe ser un número.`,
  isPositive: (c) => `El campo ${c} debe ser mayor a cero.`,
  min: (c) => `El campo ${c} tiene un valor menor al permitido.`,
  max: (c) => `El campo ${c} tiene un valor mayor al permitido.`,
  minLength: (c) => `El campo ${c} es demasiado corto.`,
  maxLength: (c) => `El campo ${c} es demasiado largo.`,
  isEmail: () => 'El correo electrónico no tiene un formato válido.',
  isBoolean: (c) => `El campo ${c} debe ser verdadero o falso.`,
  isArray: (c) => `El campo ${c} debe ser una lista.`,
  isIn: (c) => `El valor del campo ${c} no es válido.`,
  isEnum: (c) => `El valor del campo ${c} no es válido.`,
  isDateString: (c) => `El campo ${c} debe ser una fecha válida (AAAA-MM-DD).`,
  matches: (c) => `El campo ${c} no tiene un formato válido.`,
  whitelistValidation: (c) => `El campo ${c} no está permitido.`,
};

// Los mensajes por defecto de class-validator empiezan con el nombre de la
// propiedad y están en inglés ("nombre should not be empty"). Si el mensaje
// del decorador es propio (en español) se respeta.
function esMensajePorDefecto(propiedad: string, mensaje: string): boolean {
  return (
    mensaje.startsWith(`${propiedad} `) ||
    mensaje.startsWith(`each value in ${propiedad}`)
  );
}

export function erroresDeValidacion(
  errores: ValidationError[],
  prefijo = '',
): ErrorDeCampo[] {
  const resultado: ErrorDeCampo[] = [];
  for (const error of errores) {
    const campo = prefijo ? `${prefijo}.${error.property}` : error.property;
    for (const [validador, mensaje] of Object.entries(
      error.constraints ?? {},
    )) {
      const traducir = MENSAJES_VALIDADOR[validador];
      resultado.push({
        campo,
        mensaje:
          traducir && esMensajePorDefecto(error.property, mensaje)
            ? traducir(campo)
            : mensaje,
      });
    }
    if (error.children?.length) {
      resultado.push(...erroresDeValidacion(error.children, campo));
    }
  }
  return resultado;
}

// exceptionFactory del ValidationPipe global: en vez de un arreglo de textos
// sueltos, responde con un error por campo.
export function excepcionDeValidacion(
  errores: ValidationError[],
): BadRequestException {
  const porCampo = erroresDeValidacion(errores);
  return new BadRequestException({
    message:
      porCampo.length === 1
        ? porCampo[0].mensaje
        : MENSAJES_POR_ESTADO[HttpStatus.BAD_REQUEST],
    errores: porCampo,
  });
}

// Cuerpo para lanzar un error de un campo concreto desde un servicio (por
// ejemplo un duplicado): el frontend lo muestra debajo de ese campo.
//   throw new ConflictException(errorDeCampo('cedula', 'Ya existe ...'));
export function errorDeCampo(
  campo: string,
  mensaje: string,
): { message: string; errores: ErrorDeCampo[] } {
  return { message: mensaje, errores: [{ campo, mensaje }] };
}
