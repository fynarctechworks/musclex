import { NestFactory, Reflector } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ApiMetadataInterceptor } from './common/interceptors/api-metadata.interceptor';
import { ApiVersionInterceptor } from './common/interceptors/api-version.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  // Validate required environment variables
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
  ];
  for (const envVar of requiredEnvVars) {
    if (!configService.get<string>(envVar)) {
      logger.error(`FATAL: Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  // Security headers
  app.use(helmet());

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

  app.enableCors({
    origin: configService
      .get<string>('CORS_ORIGINS', 'http://localhost:3000')
      .split(','),
    credentials: true,
  });

  const port = configService.get<number>('PORT', 4000);
  await app.listen(port);
  logger.log(`FitSync Pro API running on port ${port}`);
}
bootstrap();
