import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Render (and any load balancer) terminates the connection, so without this
  // every visitor shares the proxy's IP: one person's traffic would exhaust
  // the rate limit for everyone, and 10 bad logins would lock the whole shop
  // out of the admin. Trust exactly one hop — the platform's proxy.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));

  // Security headers. Covers/static may be embedded from another origin
  // (storefront on its own domain), so relax the resource policy only.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Same-origin by default (dev uses the Vite proxy; prod a reverse proxy).
  // Set CORS_ORIGINS to a comma-separated allowlist only when the frontends
  // are served from different origins than the API.
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: corsOrigins?.length ? corsOrigins : false,
    credentials: true,
    // Lets the admin read the export's file name and size.
    exposedHeaders: ['Content-Disposition', 'X-Export-Books', 'X-Export-Truncated'],
  });

  app.setGlobalPrefix('api');
  // transform: handlers receive the validated DTO instance, so @Transform
  // normalisation (e.g. phone numbers) actually reaches the database.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Consistent JSON error envelope + server-error logging (Sentry-ready).
  app.useGlobalFilters(new AllExceptionsFilter());

  // Close the DB pool and finish in-flight requests on SIGTERM (deploys).
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
