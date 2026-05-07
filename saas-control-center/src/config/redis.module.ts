import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * In-memory fallback that implements the Redis commands used by the auth service.
 * Allows the app to run without a Redis instance in development.
 */
class InMemoryRedis {
  private store = new Map<string, { value: string; expiry?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiry && Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.store.set(key, { value });
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    this.store.set(key, { value, expiry: Date.now() + seconds * 1000 });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    const entry = this.store.get(key);
    const current = entry ? parseInt(entry.value) || 0 : 0;
    const next = current + 1;
    this.store.set(key, { value: String(next), expiry: entry?.expiry });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiry = Date.now() + seconds * 1000;
    return 1;
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: async (config: ConfigService) => {
        const host = config.get('REDIS_HOST', 'localhost');
        const port = config.get<number>('REDIS_PORT', 6379);
        const password = config.get('REDIS_PASSWORD', undefined);
        const logger = new Logger('RedisModule');

        return new Promise((resolve) => {
          const tls = config.get('REDIS_TLS') === 'true';
          const client = new Redis({
            host,
            port,
            password: password || undefined,
            maxRetriesPerRequest: 1,
            connectTimeout: 3000,
            retryStrategy: () => null, // don't retry
            lazyConnect: true,
            ...(tls ? { tls: {} } : {}),
          });

          client
            .connect()
            .then(() => {
              logger.log(`Connected to Redis at ${host}:${port}`);
              resolve(client);
            })
            .catch(() => {
              logger.warn(
                `Redis unavailable at ${host}:${port} — using in-memory fallback`,
              );
              client.disconnect();
              resolve(new InMemoryRedis() as unknown as Redis);
            });
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
