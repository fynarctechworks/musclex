import './instrument';
import { NestFactory, Reflector } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger as PinoLogger } from 'nestjs-pino';
import * as Sentry from '@sentry/nestjs';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { ApiMetadataInterceptor } from './common/interceptors/api-metadata.interceptor';
import { ApiVersionInterceptor } from './common/interceptors/api-version.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  // Validate required environment variables
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
    'JWT_SECRET',
    'HASH_SECRET',
  ];

  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  if (isProduction) {
    requiredEnvVars.push('CORS_ORIGINS', 'TWO_FACTOR_ENCRYPTION_KEY', 'RAZORPAY_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRET');
  }

  for (const envVar of requiredEnvVars) {
    if (!configService.get<string>(envVar)) {
      logger.error(`FATAL: Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  // Security headers
  app.use(helmet());

  // gzip compression
  app.use(compression());

  // Request body size limit (1MB)
  app.use(
    require('express').json({ limit: '1mb' }),
    require('express').urlencoded({ limit: '1mb', extended: true }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global interceptors: API metadata headers + versioning/deprecation
  app.useGlobalInterceptors(
    new ApiMetadataInterceptor(),
    new ApiVersionInterceptor(reflector),
  );

  // Sentry error tracking (only when DSN is configured)
  if (configService.get<string>('SENTRY_DSN')) {
    const { SentryGlobalFilter } = await import('@sentry/nestjs/setup');
    app.useGlobalFilters(new SentryGlobalFilter());
  }

  app.enableCors({
    origin: configService
      .get<string>('CORS_ORIGINS', 'http://localhost:3000')
      .split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-studio-id', 'x-branch-id', 'x-active-branch-id', 'x-correlation-id'],
    maxAge: 86400,
  });

  const port = configService.get<number>('PORT', 4000);
  await app.listen(port);
  logger.log(`MuscleX API running on port ${port}`);
}
bootstrap();
