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

  // Habilitar CORS solo para los frontends conocidos (con credenciales,
  // necesario para que el navegador envíe la cookie httpOnly del Refresh
  // Token). FRONTEND_URL acepta una lista separada por comas para poder
  // tener a la vez el dev local (localhost:5173) y el sitio ya publicado
  // (ej. Netlify) sin tener que elegir uno — si no se define, cae solo al
  // local de siempre.
  const origenesPermitidos = (
    process.env.FRONTEND_URL ?? 'http://localhost:5173'
  )
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origenesPermitidos,
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
