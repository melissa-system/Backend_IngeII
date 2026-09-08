import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

// Token de inyección: los servicios que necesiten Cloudinary lo piden con
// @Inject(CLOUDINARY) en vez de importar el SDK directamente. Así el día que
// se cambie de proveedor solo hay que tocar este archivo.
export const CLOUDINARY = 'CLOUDINARY';

// Configura el SDK de Cloudinary una sola vez al arrancar la aplicación.
// Si faltan credenciales no se lanza una excepción que tumbe todo el backend
// (el resto del sistema debe poder arrancar igual, por ejemplo para que un
// compañero trabaje en otro módulo sin tener cuenta de Cloudinary), pero sí
// se deja un aviso claro en consola para que no pase desapercibido.
export const CloudinaryProvider: Provider = {
  provide: CLOUDINARY,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const logger = new Logger('CloudinaryProvider');

    const cloud_name = configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const api_key = configService.get<string>('CLOUDINARY_API_KEY');
    const api_secret = configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloud_name || !api_key || !api_secret) {
      logger.warn(
        'Faltan credenciales de Cloudinary en el .env (CLOUDINARY_CLOUD_NAME, ' +
          'CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET). La subida de archivos ' +
          'a la nube fallará hasta que se configuren.',
      );
      return cloudinary;
    }

    cloudinary.config({
      cloud_name,
      api_key,
      api_secret,
      // Fuerza HTTPS en las URLs devueltas (secure_url).
      secure: true,
    });

    logger.log(`Cloudinary configurado correctamente (cloud: ${cloud_name})`);
    return cloudinary;
  },
};