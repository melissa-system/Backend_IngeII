import {
  correoValido,
  debeNotificar,
  notificarResultado,
  registrarNotificacion,
} from './notificacion-resultado';

describe('notificacion-resultado', () => {
  describe('correoValido', () => {
    it.each(['a@b.co', 'persona.nombre@dominio.cr', ' con.espacios@x.org '])(
      'acepta %s',
      (c) => expect(correoValido(c)).toBe(true),
    );
    it.each([null, undefined, '', '   ', 'sin-arroba', 'a@b', 'a b@c.com'])(
      'rechaza %p',
      (c) => expect(correoValido(c as string)).toBe(false),
    );
  });

  describe('debeNotificar (evita duplicados)', () => {
    it('notifica al pasar a aprobado o rechazado', () => {
      expect(debeNotificar('pendiente', 'aprobado')).toBe(true);
      expect(debeNotificar('en_proceso', 'rechazado')).toBe(true);
      expect(debeNotificar('Pendiente', 'Aprobada')).toBe(true);
      expect(debeNotificar('En proceso', 'Rechazada')).toBe(true);
    });
    it('no notifica si el estado no cambió', () => {
      expect(debeNotificar('aprobado', 'aprobado')).toBe(false);
    });
    it('no notifica en estados que no son el resultado final', () => {
      expect(debeNotificar('pendiente', 'en_proceso')).toBe(false);
    });
    it('no repite si ya se envió una notificación exitosa', () => {
      expect(debeNotificar('pendiente', 'aprobado', 'enviada')).toBe(false);
    });
    it('permite reintentar si la anterior falló o se omitió', () => {
      expect(debeNotificar('pendiente', 'aprobado', 'fallida')).toBe(true);
      expect(debeNotificar('pendiente', 'aprobado', 'omitida')).toBe(true);
    });
  });

  describe('notificarResultado', () => {
    it('envía y registra "enviada"', async () => {
      const enviar = jest.fn().mockResolvedValue(undefined);
      const r = await notificarResultado({
        destinatario: ' a@b.com ',
        codigo: 'SOL-1',
        enviar,
      });
      expect(enviar).toHaveBeenCalledWith('a@b.com');
      expect(r.notificacion_estado).toBe('enviada');
      expect(r.notificacion_error).toBeNull();
      expect(r.notificacion_fecha).toBeInstanceOf(Date);
    });

    it('sin correo válido NO intenta enviar y registra "omitida"', async () => {
      const enviar = jest.fn();
      const r = await notificarResultado({
        destinatario: 'no-es-correo',
        codigo: 'SOL-2',
        enviar,
      });
      expect(enviar).not.toHaveBeenCalled();
      expect(r.notificacion_estado).toBe('omitida');
      expect(r.notificacion_error).toMatch(/correo/i);
    });

    it('si el envío falla no lanza y registra "fallida" con el motivo', async () => {
      const enviar = jest.fn().mockRejectedValue(new Error('SMTP caído'));
      const r = await notificarResultado({
        destinatario: 'a@b.com',
        codigo: 'SOL-3',
        enviar,
      });
      expect(r.notificacion_estado).toBe('fallida');
      expect(r.notificacion_error).toBe('SMTP caído');
    });

    it('recorta errores muy largos a 255 caracteres', async () => {
      const enviar = jest.fn().mockRejectedValue(new Error('x'.repeat(500)));
      const r = await notificarResultado({
        destinatario: 'a@b.com',
        codigo: 'SOL-4',
        enviar,
      });
      expect(r.notificacion_error).toHaveLength(255);
    });
  });

  describe('registrarNotificacion', () => {
    it('guarda el resultado en la solicitud', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const resultado = {
        notificacion_estado: 'enviada' as const,
        notificacion_fecha: new Date(),
        notificacion_error: null,
      };
      await registrarNotificacion({ update }, 7, resultado);
      expect(update).toHaveBeenCalledWith(7, resultado);
    });
    it('si falla guardar la trazabilidad no lanza', async () => {
      const update = jest.fn().mockRejectedValue(new Error('db'));
      await expect(
        registrarNotificacion({ update }, 7, {
          notificacion_estado: 'fallida',
          notificacion_fecha: new Date(),
          notificacion_error: 'x',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
