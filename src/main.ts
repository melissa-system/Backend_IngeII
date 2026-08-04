import { NestFactory } from '@nestjs/core';
import { configDotenv } from 'dotenv';

configDotenv({ path: '.env', override: true });

async function bootstrap() {
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para que el frontend (puerto 5173) se comunique sin bloqueos
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
