import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from '../../src/common/guards/api-key.guard';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createMockPrismaService, createMockConfigService } from '../test-utils';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: createMockConfigService() },
      ],
    }).compile();

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);
  });

  function createMockExecutionContext(headers: Record<string, string> = {}): ExecutionContext {
    const request = {
      headers,
      user: null as any,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should reject requests without x-api-key header', async () => {
    const ctx = createMockExecutionContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject requests without x-studio-id header', async () => {
    const ctx = createMockExecutionContext({ 'x-api-key': 'test-key' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject requests with invalid studio_id UUID', async () => {
    const ctx = createMockExecutionContext({
      'x-api-key': 'test-key',
      'x-studio-id': 'not-a-uuid',
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject requests when API key not found in database', async () => {
    // Mock schema existence check
    prisma.$queryRawUnsafe = jest.fn().mockResolvedValue([{ exists: true }]);
    prisma.$executeRawUnsafe = jest.fn().mockResolvedValue(undefined);

    const validUUID = '550e8400-e29b-41d4-a716-446655440000';
    const ctx = createMockExecutionContext({
      'x-api-key': 'nonexistent-key',
      'x-studio-id': validUUID,
    });

    // No API key found
    (prisma as any).apiKey = { findUnique: jest.fn().mockResolvedValue(null) };

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
