import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IdempotencyStore } from './idempotency-store.service';
import { StaffIdempotencyInterceptor } from './staff-idempotency.interceptor';

/**
 * Provides the Redis-backed staff idempotency store + interceptor. @Global so
 * any controller can apply @UseInterceptors(StaffIdempotencyInterceptor) +
 * @Idempotent() without importing this module explicitly.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [IdempotencyStore, StaffIdempotencyInterceptor],
  exports: [IdempotencyStore, StaffIdempotencyInterceptor],
})
export class IdempotencyModule {}
