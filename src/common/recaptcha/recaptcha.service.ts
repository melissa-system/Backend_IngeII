import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Endpoint oficial de verificación de Google reCAPTCHA.
const URL_VERIFICACION = 'https://www.google.com/recaptcha/api/siteverify';

// Tiempo máximo de espera a Google. Si no responde en este plazo se trata
// como servicio caído (ver politicaSiGoogleFalla), para que un formulario
// público nunca se quede colgado esperando.
const TIEMPO_ESPERA_MS = 5000;

// motivo solo viene cuando valido es false. Se modela como un campo
// opcional y no como unión de tipos porque el proyecto usa
// strictNullChecks: false, y con esa configuración TypeScript no acota
// bien una unión discriminada por un booleano.
export interface ResultadoVerificacion {
  valido: boolean;
  motivo?: 'expirado' | 'invalido';
}

// Respuesta de Google (solo los campos que se usan).
interface RespuestaGoogle {
  success: boolean;
  'error-codes'?: string[];
}

// Verificación de tokens de Google reCAPTCHA v2 ("No soy un robot").
//
// Es la única pieza del sistema que habla con Google: el guard y cualquier
// endpoint público nuevo la usan a través de @ProtegidoConRecaptcha(), así
// que cambiar de versión (por ejemplo a v3) o de proveedor solo toca este
// archivo.
@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);
  private readonly claveSecreta: string | undefined;
  private readonly permitirSiGoogleFalla: boolean;

  constructor(configService: ConfigService) {
    this.claveSecreta = configService.get<string>('RECAPTCHA_SECRET_KEY');

    // Qué hacer si Google no responde (caída, sin internet, tiempo agotado):
    //  - true (por defecto): se deja pasar y se registra una advertencia.
    //    Prioriza que la comunidad pueda seguir reportando averías aunque
    //    Google esté caído; el riesgo es acotado porque los endpoints
    //    públicos ya tienen otras defensas (control de duplicados).
    //  - false: se rechaza la petición. Más seguro, pero si Google falla,
    //    nadie puede enviar formularios públicos.
    this.permitirSiGoogleFalla =
      configService.get<string>('RECAPTCHA_FAIL_OPEN') !== 'false';

    if (!this.claveSecreta) {
      this.logger.warn(
        'Falta RECAPTCHA_SECRET_KEY en el .env: los formularios públicos NO ' +
          'están protegidos contra bots. Para desarrollo se pueden usar las ' +
          'claves de prueba de Google (ver .env.example).',
      );
    }
  }

  async verificar(token: string, ip?: string): Promise<ResultadoVerificacion> {
    if (!this.claveSecreta) {
      return this.politicaSiGoogleFalla('no hay clave secreta configurada');
    }

    const cuerpo = new URLSearchParams({
      secret: this.claveSecreta,
      response: token,
    });
    if (ip) cuerpo.set('remoteip', ip);

    const cancelar = new AbortController();
    const temporizador = setTimeout(() => cancelar.abort(), TIEMPO_ESPERA_MS);

    let respuesta: RespuestaGoogle;
    try {
      const http = await fetch(URL_VERIFICACION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: cuerpo.toString(),
        signal: cancelar.signal,
      });
      if (!http.ok) {
        return this.politicaSiGoogleFalla(
          `Google respondió HTTP ${http.status}`,
        );
      }
      respuesta = (await http.json()) as RespuestaGoogle;
    } catch (error) {
      return this.politicaSiGoogleFalla(
        cancelar.signal.aborted
          ? `Google no respondió en ${TIEMPO_ESPERA_MS / 1000} s`
          : `no se pudo contactar a Google (${(error as Error).message})`,
      );
    } finally {
      clearTimeout(temporizador);
    }

    if (respuesta.success) return { valido: true };

    // 'timeout-or-duplicate': el token venció (duran unos 2 minutos) o ya se
    // usó en otro envío. Se distingue del resto para poder pedirle a la
    // persona que vuelva a marcar la casilla, en vez de un mensaje genérico.
    const codigos = respuesta['error-codes'] ?? [];
    if (codigos.includes('timeout-or-duplicate')) {
      return { valido: false, motivo: 'expirado' };
    }

    // Error de configuración nuestra (clave secreta mal copiada): la persona
    // que llena el formulario no tiene la culpa, así que queda constancia
    // clara en el log del servidor.
    if (codigos.some((codigo) => codigo.includes('secret'))) {
      this.logger.error(
        `La clave secreta de reCAPTCHA es inválida (${codigos.join(', ')}). Revisar RECAPTCHA_SECRET_KEY.`,
      );
    }

    return { valido: false, motivo: 'invalido' };
  }

  private politicaSiGoogleFalla(razon: string): ResultadoVerificacion {
    if (this.permitirSiGoogleFalla) {
      this.logger.warn(
        `reCAPTCHA no verificado (${razon}); se deja pasar por RECAPTCHA_FAIL_OPEN.`,
      );
      return { valido: true };
    }
    this.logger.error(
      `reCAPTCHA no verificado (${razon}); petición rechazada.`,
    );
    return { valido: false, motivo: 'invalido' };
  }
}
