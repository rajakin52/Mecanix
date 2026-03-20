import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8081',
    ],
    credentials: true,
  });

  const port = process.env['PORT'] ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`MECANIX API running on port ${port}`);
}

bootstrap();
