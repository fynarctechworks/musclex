import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { lastValueFrom, throwError } from 'rxjs';
import { ObservabilityInterceptor } from './observability.interceptor';

function ctx(req: Record<string, unknown> = { method: 'GET', url: '/x' }) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
}

function handlerThatThrows(err: unknown) {
  return { handle: () => throwError(() => err) } as never;
}

describe('ObservabilityInterceptor', () => {
  const makeReporter = (enabled = true) =>
    ({ enabled, report: jest.fn() }) as never as {
      enabled: boolean;
      report: jest.Mock;
    };

  it('reports 5xx server errors as BACKEND and rethrows', async () => {
    const reporter = makeReporter();
    const i = new ObservabilityInterceptor(reporter as never);
    await expect(
      lastValueFrom(
        i.intercept(ctx(), handlerThatThrows(new InternalServerErrorException('boom'))),
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(reporter.report).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'BACKEND', http_status: 500 }),
    );
  });

  it('skips expected client errors (<500)', async () => {
    const reporter = makeReporter();
    const i = new ObservabilityInterceptor(reporter as never);
    await expect(
      lastValueFrom(i.intercept(ctx(), handlerThatThrows(new BadRequestException('nope')))),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(reporter.report).not.toHaveBeenCalled();
  });

  it('tags Prisma errors as DATABASE', async () => {
    const reporter = makeReporter();
    const i = new ObservabilityInterceptor(reporter as never);
    class PrismaClientKnownRequestError extends Error {}
    await expect(
      lastValueFrom(
        i.intercept(ctx(), handlerThatThrows(new PrismaClientKnownRequestError('db down'))),
      ),
    ).rejects.toBeDefined();
    expect(reporter.report).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'DATABASE' }),
    );
  });

  it('does nothing when the reporter is disabled', async () => {
    const reporter = makeReporter(false);
    const i = new ObservabilityInterceptor(reporter as never);
    await expect(
      lastValueFrom(i.intercept(ctx(), handlerThatThrows(new Error('x')))),
    ).rejects.toBeDefined();
    expect(reporter.report).not.toHaveBeenCalled();
  });
});
