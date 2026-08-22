import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import * as cookieParser from 'cookie-parser';
import { configDotenv } from 'dotenv';

configDotenv({ path: '.env', override: true });

async function bootstrap() {
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Habilitar CORS solo para el frontend (puerto 5173) y con credenciales,
  // necesario para que el navegador envíe la cookie httpOnly del Refresh Token.
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
    // Sin esto el navegador oculta Retry-After (no es un header CORS simple)
    // y el frontend no podría mostrar el contador regresivo del bloqueo.
    exposedHeaders: ['Retry-After'],
  });

  // Parseo de cookies para leer el Refresh Token en /auth/refresh y /auth/logout.
  app.use(cookieParser());

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
