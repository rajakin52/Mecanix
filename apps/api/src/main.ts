import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import rateLimit from '@fastify/rate-limit';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true, bodyLimit: 20 * 1024 * 1024 /* 20MB for photo uploads */ }),
  );

  // Global rate limiting — 100 req/min per IP
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
  });

  app.setGlobalPrefix('api/v1');

  const allowedOrigins = process.env['CORS_ORIGINS']
    ? process.env['CORS_ORIGINS'].split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) {
        callback(null, true);
        return;
      }
      // Allow explicitly listed origins
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      // Allow all Vercel preview/production URLs for this project
      if (origin.endsWith('.vercel.app') && origin.includes('mecanix')) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  });

  const port = process.env['PORT'] ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`MECANIX API running on port ${port}`);
}

bootstrap();
