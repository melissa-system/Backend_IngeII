import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { configDotenv } from 'dotenv';

configDotenv({ path: '.env', override: true });

async function bootstrap() {
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Habilitar CORS para que el frontend (puerto 5173) se comunique sin bloqueos
  app.enableCors();

  // Validación global de DTOs.
  // whitelist: false -> no borra campos sin decorador.
  // forbidUnknownValues: false -> no rechaza DTOs sin metadatos de validación
  // (evita romper el POST de averías, cuyo DTO aún no usa decoradores).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  // Exponer los archivos adjuntos guardados en uploads/ (ej: solicitudes de paja de agua)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
