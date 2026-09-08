import { BadRequestException } from '@nestjs/common';
import {
  multerFileFilterDocumento,
  validarTamanoDocumento,
  MAX_DOCUMENTO_FILE_SIZE,
  MENSAJE_FORMATO_NO_PERMITIDO,
  MENSAJE_TAMANO_EXCEDIDO,
} from './documento-upload.config';

// Verifica exactamente las mismas reglas que usan las rutas POST /documentos
// y POST /documentos/:id/version (carga inicial y nueva versión), ya que
// ambas importan estas funciones en vez de reimplementar la validación.

function archivo(mimetype: string, size: number): Express.Multer.File {
  return { mimetype, size } as Express.Multer.File;
}

describe('multerFileFilterDocumento (formato de archivo)', () => {
  it.each([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
  ])('acepta %s', (mimetype) => {
    const callback = jest.fn();
    multerFileFilterDocumento({}, archivo(mimetype, 1000), callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it.each([
    'text/plain',
    'application/zip',
    'application/x-msdownload',
    'video/mp4',
    'image/gif',
  ])('rechaza %s con un mensaje específico', (mimetype) => {
    const callback = jest.fn();
    multerFileFilterDocumento({}, archivo(mimetype, 1000), callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const [error, aceptado] = callback.mock.calls[0];
    expect(aceptado).toBe(false);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe(MENSAJE_FORMATO_NO_PERMITIDO);
  });
});

describe('validarTamanoDocumento (tamaño de archivo)', () => {
  it('no lanza nada si no hay archivo (lo valida el service aparte)', () => {
    expect(() => validarTamanoDocumento(undefined)).not.toThrow();
  });

  it('acepta un archivo exactamente en el límite (10 MB)', () => {
    expect(() =>
      validarTamanoDocumento(archivo('application/pdf', MAX_DOCUMENTO_FILE_SIZE)),
    ).not.toThrow();
  });

  it('acepta un archivo por debajo del límite', () => {
    expect(() =>
      validarTamanoDocumento(archivo('application/pdf', 500)),
    ).not.toThrow();
  });

  it('rechaza un archivo que excede el máximo, con mensaje específico', () => {
    expect(() =>
      validarTamanoDocumento(
        archivo('application/pdf', MAX_DOCUMENTO_FILE_SIZE + 1),
      ),
    ).toThrow(new BadRequestException(MENSAJE_TAMANO_EXCEDIDO));
  });
});
