import { BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { RecaptchaService } from './recaptcha.service';
import { RecaptchaGuard, ENCABEZADO_RECAPTCHA } from './recaptcha.guard';

// Pruebas de la protección anti-spam de los formularios públicos. La llamada
// a Google se simula con un mock de fetch, así que corren sin internet.

function configFalso(valores: Record<string, string | undefined>) {
  return { get: (clave: string) => valores[clave] } as any;
}

function respuestaGoogle(cuerpo: object, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(cuerpo) });
}

// Contexto de ejecución falso: el guard solo necesita los encabezados y la IP.
function contexto(token?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: token === undefined ? {} : { [ENCABEZADO_RECAPTCHA]: token },
        ip: '10.0.0.1',
      }),
    }),
  } as any;
}

describe('RecaptchaService', () => {
  const fetchOriginal = global.fetch;
  // El constructor avisa cuando no hay clave secreta: se silencia para que
  // la salida de las pruebas quede limpia.
  const avisoOriginal = Logger.prototype.warn;
  let servicio: RecaptchaService;

  function crearServicio(valores: Record<string, string | undefined> = {}) {
    const s = new RecaptchaService(
      configFalso({ RECAPTCHA_SECRET_KEY: 'secreto-de-prueba', ...valores }),
    );
    // Silenciar los avisos esperados en las pruebas de fallo.
    (s as any).logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
    return s;
  }

  beforeEach(() => {
    Logger.prototype.warn = () => undefined;
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    Logger.prototype.warn = avisoOriginal;
  });

  it('acepta el token cuando Google responde success', async () => {
    global.fetch = jest.fn(() => respuestaGoogle({ success: true })) as any;
    servicio = crearServicio();

    expect(await servicio.verificar('token-bueno')).toEqual({ valido: true });
  });

  it('envía a Google la clave secreta, el token y la IP de quien llena el formulario', async () => {
    const fetchMock = jest.fn(() => respuestaGoogle({ success: true }));
    global.fetch = fetchMock as any;
    servicio = crearServicio();

    await servicio.verificar('token-bueno', '190.0.0.9');

    const [url, opciones] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe('https://www.google.com/recaptcha/api/siteverify');
    const enviado = new URLSearchParams(opciones.body);
    expect(enviado.get('secret')).toBe('secreto-de-prueba');
    expect(enviado.get('response')).toBe('token-bueno');
    expect(enviado.get('remoteip')).toBe('190.0.0.9');
  });

  it('marca como expirado un token vencido o ya usado', async () => {
    global.fetch = jest.fn(() =>
      respuestaGoogle({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
    ) as any;
    servicio = crearServicio();

    expect(await servicio.verificar('token-viejo')).toEqual({
      valido: false,
      motivo: 'expirado',
    });
  });

  it('marca como inválido un token falso', async () => {
    global.fetch = jest.fn(() =>
      respuestaGoogle({ success: false, 'error-codes': ['invalid-input-response'] }),
    ) as any;
    servicio = crearServicio();

    expect(await servicio.verificar('token-inventado')).toEqual({
      valido: false,
      motivo: 'invalido',
    });
  });

  it('deja constancia en el log si nuestra clave secreta está mal configurada', async () => {
    global.fetch = jest.fn(() =>
      respuestaGoogle({ success: false, 'error-codes': ['invalid-input-secret'] }),
    ) as any;
    servicio = crearServicio();

    await servicio.verificar('token');

    expect((servicio as any).logger.error).toHaveBeenCalledTimes(1);
  });

  describe('cuando Google no responde', () => {
    it('por defecto deja pasar la petición para no bloquear los formularios', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('sin internet'))) as any;
      servicio = crearServicio();

      expect(await servicio.verificar('token')).toEqual({ valido: true });
      expect((servicio as any).logger.warn).toHaveBeenCalledTimes(1);
    });

    it('con RECAPTCHA_FAIL_OPEN=false rechaza la petición', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('sin internet'))) as any;
      servicio = crearServicio({ RECAPTCHA_FAIL_OPEN: 'false' });

      expect(await servicio.verificar('token')).toEqual({
        valido: false,
        motivo: 'invalido',
      });
    });

    it('trata un HTTP 500 de Google igual que una caída', async () => {
      global.fetch = jest.fn(() => respuestaGoogle({}, false)) as any;
      servicio = crearServicio({ RECAPTCHA_FAIL_OPEN: 'false' });

      expect(await servicio.verificar('token')).toEqual({
        valido: false,
        motivo: 'invalido',
      });
    });
  });

  it('sin clave secreta configurada avisa y aplica la misma política', async () => {
    global.fetch = jest.fn() as any;
    servicio = crearServicio({ RECAPTCHA_SECRET_KEY: undefined });

    expect(await servicio.verificar('token')).toEqual({ valido: true });
    // Ni siquiera intenta llamar a Google: no hay con qué verificar.
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('RecaptchaGuard', () => {
  let recaptchaService: { verificar: jest.Mock };
  let guard: RecaptchaGuard;

  beforeEach(() => {
    recaptchaService = { verificar: jest.fn() };
    guard = new RecaptchaGuard(recaptchaService as unknown as RecaptchaService);
  });

  it('400 si la petición no trae el encabezado del token', async () => {
    await expect(guard.canActivate(contexto())).rejects.toThrow(BadRequestException);
    expect(recaptchaService.verificar).not.toHaveBeenCalled();
  });

  it('400 si el token viene vacío', async () => {
    await expect(guard.canActivate(contexto('   '))).rejects.toThrow(BadRequestException);
  });

  it('deja pasar la petición si el token es válido', async () => {
    recaptchaService.verificar.mockImplementationOnce(() =>
      Promise.resolve({ valido: true }),
    );

    expect(await guard.canActivate(contexto('token-bueno'))).toBe(true);
    expect(recaptchaService.verificar).toHaveBeenCalledWith('token-bueno', '10.0.0.1');
  });

  it('403 con mensaje de "vencida" si el token expiró', async () => {
    // mockImplementation (y no ...Once) porque el test hace dos llamadas.
    recaptchaService.verificar.mockImplementation(() =>
      Promise.resolve({ valido: false, motivo: 'expirado' }),
    );

    await expect(guard.canActivate(contexto('token-viejo'))).rejects.toThrow(
      /venció/,
    );
    await expect(
      guard.canActivate(contexto('token-viejo')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('403 si el token es inválido', async () => {
    recaptchaService.verificar.mockImplementation(() =>
      Promise.resolve({ valido: false, motivo: 'invalido' }),
    );

    await expect(guard.canActivate(contexto('token-falso'))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
