import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import {
  CODIGOS_ERROR,
  ErrorDeCampo,
  MENSAJES_POR_ESTADO,
  RespuestaError,
  TRADUCCIONES,
} from './respuesta-error';

// Filtro global de errores (PBI 511 / Task 516): convierte cualquier error en
// el formato único de respuesta-error.ts. Los errores inesperados se
// registran en el log del servidor, pero al cliente solo le llega un mensaje
// genérico, sin detalles técnicos ni datos de la base de datos.
@Catch()
export class FiltroErrores implements ExceptionFilter {
  private readonly logger = new Logger('FiltroErrores');

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();
    const cuerpo = this.construirRespuesta(excepcion);
    respuesta.status(cuerpo.statusCode).json(cuerpo);
  }

  construirRespuesta(excepcion: unknown): RespuestaError {
    if (excepcion instanceof HttpException) {
      return this.desdeHttpException(excepcion);
    }
    if (excepcion instanceof QueryFailedError) {
      return this.desdeErrorDeBaseDeDatos(excepcion);
    }
    this.logger.error(
      excepcion instanceof Error ? excepcion.stack : String(excepcion),
    );
    return this.respuesta(HttpStatus.INTERNAL_SERVER_ERROR);
  }

  private desdeHttpException(excepcion: HttpException): RespuestaError {
    const estado = excepcion.getStatus();
    const original = excepcion.getResponse();

    if (estado >= 500) {
      // Los 500 lanzados a propósito ya traen un mensaje pensado para el
      // usuario; solo se registra el detalle.
      this.logger.error(excepcion.stack);
    }

    if (typeof original === 'string') {
      return this.respuesta(estado, original);
    }

    const {
      message,
      errores,
      statusCode: _statusCode,
      error: _error,
      ...extra
    } = original as Record<string, unknown>;

    // Arreglo de textos: formato por defecto del ValidationPipe de Nest.
    if (Array.isArray(message)) {
      const textos = message.map(String);
      return this.respuesta(
        estado,
        textos.length === 1 ? textos[0] : undefined,
        textos.map((mensaje) => ({ campo: '', mensaje })),
        extra,
      );
    }

    return this.respuesta(
      estado,
      typeof message === 'string' ? message : undefined,
      Array.isArray(errores) ? (errores as ErrorDeCampo[]) : [],
      extra,
    );
  }

  private desdeErrorDeBaseDeDatos(excepcion: QueryFailedError): RespuestaError {
    const codigo = (excepcion.driverError as { code?: string } | undefined)
      ?.code;
    if (codigo === 'ER_DUP_ENTRY') {
      return this.respuesta(
        HttpStatus.CONFLICT,
        'Ya existe un registro con esos datos.',
      );
    }
    if (codigo === 'ER_DATA_TOO_LONG') {
      return this.respuesta(
        HttpStatus.BAD_REQUEST,
        'Uno de los campos supera el largo permitido.',
      );
    }
    if (
      codigo === 'ER_NO_REFERENCED_ROW_2' ||
      codigo === 'ER_NO_REFERENCED_ROW'
    ) {
      return this.respuesta(
        HttpStatus.BAD_REQUEST,
        'Uno de los registros relacionados no existe.',
      );
    }
    this.logger.error(excepcion.stack);
    return this.respuesta(HttpStatus.INTERNAL_SERVER_ERROR);
  }

  private respuesta(
    estado: number,
    mensaje?: string,
    errores: ErrorDeCampo[] = [],
    extra: Record<string, unknown> = {},
  ): RespuestaError {
    const texto = mensaje?.trim();
    return {
      ...extra,
      statusCode: estado,
      codigo:
        CODIGOS_ERROR[estado] ??
        (estado >= 500 ? 'ERROR_INTERNO' : 'DATOS_INVALIDOS'),
      message:
        (texto && (TRADUCCIONES[texto] ?? texto)) ||
        MENSAJES_POR_ESTADO[estado] ||
        (estado >= 500
          ? MENSAJES_POR_ESTADO[HttpStatus.INTERNAL_SERVER_ERROR]
          : MENSAJES_POR_ESTADO[HttpStatus.BAD_REQUEST]),
      errores,
    };
  }
}
