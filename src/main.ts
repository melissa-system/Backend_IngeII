import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
<<<<<<< HEAD
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
=======

  // Habilitar CORS para que el frontend (puerto 5173) se comunique sin bloqueos
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
>>>>>>> 159a38f (feat: modulo backend de reporte de averias terminado)
