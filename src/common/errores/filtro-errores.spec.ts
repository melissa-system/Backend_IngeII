import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';
import { FiltroErrores } from './filtro-errores.filter';
import { errorDeCampo, excepcionDeValidacion } from './respuesta-error';
import { CreateAbonadoDto } from '../../modules/abonados/dto/create-abonado.dto';

// PBI 511 / Task 516: todas las respuestas de error comparten el mismo
// formato { statusCode, codigo, message, errores } y nunca exponen detalles
// técnicos.

class DtoSinMensajes {
  @IsString()
  @IsNotEmpty()
  nombre: string;
}

async function errorDeValidacion(
  metatipo: new () => object,
  valor: Record<string, unknown>,
): Promise<unknown> {
  const pipe = new ValidationPipe({
    transform: true,
    exceptionFactory: excepcionDeValidacion,
  });
  try {
    await pipe.transform(valor, { type: 'body', metatype: metatipo });
  } catch (e) {
    return e;
  }
  throw new Error('Se esperaba un error de validación');
}

describe('Formato único de errores de la API (PBI 511 / Task 516)', () => {
  const filtro = new FiltroErrores();

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('los errores de validación salen con un mensaje por campo', async () => {
    const error = await errorDeValidacion(CreateAbonadoDto, {
      tipo_abonado: 'Física',
      nombre: 'Ana',
      cedula: '123',
      telefono: '8888-8888',
      correo: 'ana@correo.com',
      direccion: 'Pueblo Nuevo',
    });
    expect(filtro.construirRespuesta(error)).toEqual({
      statusCode: 400,
      codigo: 'DATOS_INVALIDOS',
      message:
        'La identificación debe ser una cédula física (9 dígitos), jurídica (10 dígitos) o un DIMEX (11 o 12 dígitos).',
      errores: [
        {
          campo: 'cedula',
          mensaje:
            'La identificación debe ser una cédula física (9 dígitos), jurídica (10 dígitos) o un DIMEX (11 o 12 dígitos).',
        },
      ],
    });
  });

  it('varios campos inválidos dan un mensaje general y la lista por campo', async () => {
    const error = await errorDeValidacion(CreateAbonadoDto, {});
    const respuesta = filtro.construirRespuesta(error);
    expect(respuesta.message).toBe(
      'Revise los datos marcados en el formulario.',
    );
    expect(respuesta.errores.map((e) => e.campo)).toEqual(
      expect.arrayContaining(['cedula', 'correo', 'direccion', 'nombre']),
    );
  });

  it('traduce al español los mensajes por defecto de class-validator', async () => {
    const error = await errorDeValidacion(DtoSinMensajes, {});
    const respuesta = filtro.construirRespuesta(error);
    expect(respuesta.errores).toEqual([
      { campo: 'nombre', mensaje: 'El campo nombre es obligatorio.' },
      { campo: 'nombre', mensaje: 'El campo nombre debe ser texto.' },
    ]);
  });

  it.each([
    [new BadRequestException('Dato inválido'), 400, 'DATOS_INVALIDOS'],
    [new UnauthorizedException(), 401, 'NO_AUTENTICADO'],
    [new ForbiddenException('Sin acceso'), 403, 'SIN_PERMISO'],
    [new NotFoundException('No existe'), 404, 'NO_ENCONTRADO'],
    [new ConflictException('Ya existe'), 409, 'DUPLICADO'],
  ])('usa el código de estado coherente (%#)', (excepcion, estado, codigo) => {
    const respuesta = filtro.construirRespuesta(excepcion);
    expect(respuesta.statusCode).toBe(estado);
    expect(respuesta.codigo).toBe(codigo);
    expect(typeof respuesta.message).toBe('string');
    expect(respuesta.errores).toEqual([]);
  });

  it('los mensajes en inglés de Nest y multer se muestran en español', () => {
    expect(filtro.construirRespuesta(new UnauthorizedException()).message).toBe(
      'Debe iniciar sesión para continuar.',
    );
    expect(
      filtro.construirRespuesta(new PayloadTooLargeException('File too large'))
        .message,
    ).toBe('El archivo supera el tamaño permitido.');
  });

  it('conserva los datos extra del error (confirmación de cédula)', () => {
    const respuesta = filtro.construirRespuesta(
      new ConflictException({
        requiereConfirmacion: true,
        tipo: 'empleado',
        registro: { id: 3, nombre: 'Ana' },
        message: 'La cédula ya está registrada como empleado.',
      }),
    );
    expect(respuesta).toMatchObject({
      statusCode: 409,
      codigo: 'DUPLICADO',
      requiereConfirmacion: true,
      tipo: 'empleado',
      registro: { id: 3, nombre: 'Ana' },
      message: 'La cédula ya está registrada como empleado.',
    });
  });

  it('un duplicado lanzado con errorDeCampo se asocia a su campo', () => {
    const respuesta = filtro.construirRespuesta(
      new ConflictException(
        errorDeCampo('cedula', 'Ya existe un abonado con la cédula 1-1111-1111'),
      ),
    );
    expect(respuesta).toEqual({
      statusCode: 409,
      codigo: 'DUPLICADO',
      message: 'Ya existe un abonado con la cédula 1-1111-1111',
      errores: [
        {
          campo: 'cedula',
          mensaje: 'Ya existe un abonado con la cédula 1-1111-1111',
        },
      ],
    });
  });

  it('un error inesperado responde 500 sin exponer el detalle técnico', () => {
    const respuesta = filtro.construirRespuesta(
      new TypeError("Cannot read properties of undefined (reading 'id')"),
    );
    expect(respuesta).toEqual({
      statusCode: 500,
      codigo: 'ERROR_INTERNO',
      message: 'Ocurrió un error inesperado. Inténtelo de nuevo más tarde.',
      errores: [],
    });
  });

  it('un 500 lanzado a propósito conserva su mensaje para el usuario', () => {
    expect(
      filtro.construirRespuesta(
        new InternalServerErrorException('No se pudo enviar el correo.'),
      ).message,
    ).toBe('No se pudo enviar el correo.');
  });

  it('un duplicado en la base de datos responde 409 sin el SQL', () => {
    const error = new QueryFailedError(
      'INSERT INTO abonados ...',
      [],
      Object.assign(new Error("Duplicate entry '1-1111-1111'"), {
        code: 'ER_DUP_ENTRY',
      }),
    );
    expect(filtro.construirRespuesta(error)).toEqual({
      statusCode: 409,
      codigo: 'DUPLICADO',
      message: 'Ya existe un registro con esos datos.',
      errores: [],
    });
  });
});
