import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import * as http from 'http';

const port = Number(process.env['PORT'] ?? 4000);

// Start a lightweight health check server immediately so Railway's
// 10s healthcheck window passes while NestJS boots (~5-15s).
let earlyServer: http.Server | null = null;

function startEarlyHealthCheck(): Promise<void> {
  return new Promise((resolve) => {
    earlyServer = http.createServer((req, res) => {
      if (req.url === '/api/v1/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { status: 'starting', timestamp: new Date().toISOString() } }));
      } else {
        res.writeHead(503);
        res.end('Starting...');
      }
    });
    earlyServer.listen(port, '0.0.0.0', () => {
      console.log(`Early health check server on port ${port}`);
      resolve();
    });
  });
}

async function bootstrap() {
  // 1. Start early health responder
  await startEarlyHealthCheck();

  // 2. Create NestJS app (this takes several seconds)
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // 3. Close the early server and let NestJS take over the port
  if (earlyServer) {
    await new Promise<void>((resolve) => earlyServer!.close(() => resolve()));
    earlyServer = null;
    console.log('Early health check server closed');
  }

  await app.listen(port, '0.0.0.0');
  console.log(`MECANIX API running on port ${port}`);
}

bootstrap();
