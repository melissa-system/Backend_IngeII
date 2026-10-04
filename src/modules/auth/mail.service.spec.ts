import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('MailService (PBI 518 - Tasks 520 & 521)', () => {
  let service: MailService;
  let sendMailMock: jest.Mock;

  const mockConfigValues: Record<string, string> = {
    EMAIL_HOST: 'smtp.test.local',
    EMAIL_PORT: '587',
    EMAIL_SECURE: 'false',
    EMAIL_USER: 'test@asada.local',
    EMAIL_PASS: 'secret',
    EMAIL_FROM: 'ASADA Pueblo Nuevo <no-reply@asada.local>',
    FRONTEND_URL: 'http://localhost:5173',
    PUBLIC_APP_URL: 'https://asada.test',
    ASADA_NOMBRE: 'ASADA Pueblo Nuevo',
    ASADA_SUBTITULO: 'Sistema de Información y Administración de Acueductos',
    ASADA_TELEFONO: '(506) 2685-0000',
    ASADA_EMAIL_CONTACTO: 'contacto@asada.local',
  };

  beforeEach(async () => {
    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'msg-123' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: sendMailMock,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfigValues[key]),
          },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Task 520: Diseño y Creación de la Plantilla Base Reutilizable', () => {
    it('debe generar el layout base con encabezado, título, cuerpo y pie institucional', () => {
      const html = service.plantillaBase({
        titulo: 'Notificación de Prueba',
        cuerpoHtml: '<p>Este es el cuerpo de la notificación.</p>',
      });

      expect(html).toContain('<!DOCTYPE html');
      expect(html).toContain('ASADA Pueblo Nuevo');
      expect(html).toContain('Sistema de Información y Administración de Acueductos');
      expect(html).toContain('Notificación de Prueba');
      expect(html).toContain('<p>Este es el cuerpo de la notificación.</p>');
      expect(html).toContain('Tel: (506) 2685-0000');
      expect(html).toContain('contacto@asada.local');
      expect(html).toContain('Este es un correo generado automáticamente');
      expect(html).toContain('Todos los derechos reservados.');
    });

    it('debe renderizar el botón de acción CTA cuando se especifica', () => {
      const html = service.plantillaBase({
        titulo: 'Acción Requerida',
        cuerpoHtml: '<p>Por favor haga clic abajo</p>',
        boton: { texto: 'Confirmar Cuenta', url: 'https://asada.test/activar' },
      });

      expect(html).toContain('Confirmar Cuenta');
      expect(html).toContain('https://asada.test/activar');
      expect(html).toContain('role="presentation"');
    });

    it('no debe renderizar la tabla del botón CTA si no se proporciona', () => {
      const html = service.plantillaBase({
        titulo: 'Informativo',
        cuerpoHtml: '<p>Solo lectura</p>',
      });

      expect(html).not.toContain('target="_blank"');
    });

    it('debe incluir el aviso al pie cuando se suministra', () => {
      const html = service.plantillaBase({
        titulo: 'Seguridad',
        cuerpoHtml: '<p>Mensaje confidencial</p>',
        avisoPie: 'Este enlace vencerá en 30 minutos.',
      });

      expect(html).toContain('Este enlace vencerá en 30 minutos.');
    });

    it('debe sanitizar caracteres especiales en títulos y botones para prevenir inyecciones HTML', () => {
      const html = service.plantillaBase({
        titulo: 'Alerta <script>alert("xss")</script>',
        cuerpoHtml: '<p>Cuerpo seguro</p>',
        boton: { texto: 'Click & Go > Ahora', url: 'https://asada.test' },
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('Click &amp; Go &gt; Ahora');
    });
  });

  describe('Task 521: Migración Unificada de los 8 Métodos Existentes', () => {
    it('1. enviarCorreoResetPassword debe enviar el correo con token y advertencia de expiración', async () => {
      const url = 'https://asada.test/restablecer-password?token=abc';
      await service.enviarCorreoResetPassword('usuario@test.com', url);

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const call = sendMailMock.mock.calls[0][0];
      expect(call.to).toBe('usuario@test.com');
      expect(call.subject).toContain('Recuperación de Contraseña');
      expect(call.html).toContain(url);
      expect(call.html).toContain('Restablecer mi contraseña');
      expect(call.html).toContain('validez temporal');
    });

    it('2. enviarCorreoBienvenida debe enviar el correo de activación con CTA', async () => {
      const url = 'https://asada.test/activar-cuenta?token=xyz';
      await service.enviarCorreoBienvenida('nuevo@test.com', url);

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const call = sendMailMock.mock.calls[0][0];
      expect(call.to).toBe('nuevo@test.com');
      expect(call.subject).toContain('Bienvenido(a), activa tu cuenta');
      expect(call.html).toContain(url);
      expect(call.html).toContain('Activar mi cuenta');
      expect(call.html).toContain('Activación de Cuenta - ASADA');
    });

    it('3. enviarCorreoAccesoAbonado debe notificar registro administrativo y enlace para contraseña', async () => {
      const url = 'https://asada.test/restablecer-password?token=admin-create';
      await service.enviarCorreoAccesoAbonado('abonado@test.com', url);

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const call = sendMailMock.mock.calls[0][0];
      expect(call.to).toBe('abonado@test.com');
      expect(call.subject).toContain('Acceso al Sistema de Abonados');
      expect(call.html).toContain(url);
      expect(call.html).toContain('Establecer Contraseña');
      expect(call.html).toContain('registrado y habilitado satisfactoriamente su cuenta');
    });

    it('4. enviarCorreoResultadoSolicitud debe incluir badge y datos para solicitud aprobada', async () => {
      await service.enviarCorreoResultadoSolicitud('abonado@test.com', {
        tipo: 'Cambio de Medidor',
        codigo: 'SOL-2026-001',
        estadoResultado: 'aprobado',
      });

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const call = sendMailMock.mock.calls[0][0];
      expect(call.to).toBe('abonado@test.com');
      expect(call.subject).toContain('SOL-2026-001 aprobada');
      expect(call.html).toContain('SOL-2026-001');
      expect(call.html).toContain('Cambio de Medidor');
      expect(call.html).toContain('APROBADA');
      expect(call.html).toContain('actualizados en los registros de su servicio');
    });

    it('4b. enviarCorreoResultadoSolicitud debe incluir motivo de rechazo en caja destacada', async () => {
      await service.enviarCorreoResultadoSolicitud('abonado@test.com', {
        tipo: 'Cambio de Medidor',
        codigo: 'SOL-2026-002',
        estadoResultado: 'rechazado',
        motivo: 'Falta documento de propiedad actualizado',
      });

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const call = sendMailMock.mock.calls[0][0];
      expect(call.subject).toContain('SOL-2026-002 rechazada');
      expect(call.html).toContain('RECHAZADA');
      expect(call.html).toContain('Falta documento de propiedad actualizado');
    });

    it('5. enviarCorreoResultadoOtro debe notificar resultado de trámite general con comentarios', async () => {
      await service.enviarCorreoResultadoOtro('abonado@test.com', {
        codigo: 'SOL-OTRO-10',
        estadoResultado: 'aprobado',
        asunto: 'Consulta sobre reubicación de acometida',
        comentario: 'Se inspeccionó en campo y es viable la reubicación técnica.',
      });

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const call = sendMailMock.mock.calls[0][0];
      expect(call.subject).toContain('SOL-OTRO-10 aprobada');
      expect(call.html).toContain('SOL-OTRO-10');
      expect(call.html).toContain('Consulta sobre reubicación de acometida');
      expect(call.html).toContain('Se inspeccionó en campo y es viable la reubicación técnica.');
    });

    it('6. enviarCorreoResultadoCambioRepresentante debe notificar a titular y al nuevo representante si tiene correo', async () => {
      await service.enviarCorreoResultadoCambioRepresentante(
        'titular@test.com',
        'representante@test.com',
        {
          tipo: 'Cambio de Representante Legal',
          codigo: 'SOL-REP-01',
          estadoResultado: 'aprobado',
          nombreNuevoRepresentante: 'Carlos Alvarado',
        },
      );

      expect(sendMailMock).toHaveBeenCalledTimes(2);
      expect(sendMailMock.mock.calls[0][0].to).toBe('titular@test.com');
      expect(sendMailMock.mock.calls[1][0].to).toBe('representante@test.com');
      expect(sendMailMock.mock.calls[0][0].html).toContain('Carlos Alvarado');
      expect(sendMailMock.mock.calls[1][0].html).toContain('Carlos Alvarado');
    });

    it('6b. enviarCorreoResultadoCambioRepresentante no debe enviar segundo correo si es el mismo email', async () => {
      await service.enviarCorreoResultadoCambioRepresentante(
        'mismo@test.com',
        'mismo@test.com',
        {
          tipo: 'Cambio de Representante Legal',
          codigo: 'SOL-REP-02',
          estadoResultado: 'rechazado',
          motivo: 'Personería vencida en Registro Nacional',
          nombreNuevoRepresentante: 'Mismo Usuario',
        },
      );

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      expect(sendMailMock.mock.calls[0][0].to).toBe('mismo@test.com');
      expect(sendMailMock.mock.calls[0][0].html).toContain('Personería vencida en Registro Nacional');
    });

    it('7. enviarCorreoResultadoCambioPropietario debe notificar a cedente y cesionario', async () => {
      await service.enviarCorreoResultadoCambioPropietario(
        'antiguo@test.com',
        'nuevo@test.com',
        {
          tipo: 'Cesión de Derechos de Paja de Agua',
          codigo: 'SOL-PROP-55',
          estadoResultado: 'aprobado',
          nombreNuevoPropietario: 'María Eugenia Vargas',
        },
      );

      expect(sendMailMock).toHaveBeenCalledTimes(2);
      expect(sendMailMock.mock.calls[0][0].to).toBe('antiguo@test.com');
      expect(sendMailMock.mock.calls[1][0].to).toBe('nuevo@test.com');
      expect(sendMailMock.mock.calls[0][0].html).toContain('María Eugenia Vargas');
      expect(sendMailMock.mock.calls[1][0].html).toContain('María Eugenia Vargas');
    });

    it('8. enviarCorreoResultadoPajaAgua debe incluir pasos detallados y botón hacia el portal si es aprobada', async () => {
      await service.enviarCorreoResultadoPajaAgua('solicitante@test.com', {
        codigo: 'SOL-PAJA-99',
        estadoResultado: 'Aprobada',
      });

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const call = sendMailMock.mock.calls[0][0];
      expect(call.to).toBe('solicitante@test.com');
      expect(call.subject).toContain('SOL-PAJA-99 aprobada');
      expect(call.html).toContain('SOL-PAJA-99');
      expect(call.html).toContain('Permisos de Construcción y Municipales');
      expect(call.html).toContain('Ingresar al Portal de Abonados');
      expect(call.html).toContain('https://asada.test/login');
    });

    it('8b. enviarCorreoResultadoPajaAgua debe mostrar motivo si es rechazada y no incluir botón del portal', async () => {
      await service.enviarCorreoResultadoPajaAgua('solicitante@test.com', {
        codigo: 'SOL-PAJA-100',
        estadoResultado: 'Rechazada',
        motivo: 'Capacidad hídrica excedida en la cota de distribución',
      });

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const call = sendMailMock.mock.calls[0][0];
      expect(call.subject).toContain('SOL-PAJA-100 rechazada');
      expect(call.html).toContain('Capacidad hídrica excedida en la cota de distribución');
      expect(call.html).not.toContain('Ingresar al Portal de Abonados');
    });
  });
});

