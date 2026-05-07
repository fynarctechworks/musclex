import { of, lastValueFrom } from 'rxjs';
import { StripSecretsInterceptor } from '../src/common/interceptors/strip-secrets.interceptor';

function mockCtx(user?: any) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({ headersSent: false }),
    }),
  } as any;
}

function runNext(value: any) {
  return { handle: () => of(value) } as any;
}

async function run(interceptor: StripSecretsInterceptor, ctx: any, value: any) {
  return lastValueFrom(interceptor.intercept(ctx, runNext(value)) as any);
}

describe('StripSecretsInterceptor', () => {
  const interceptor = new StripSecretsInterceptor();

  it('strips face_descriptor / face_embedding on any caller', async () => {
    const result: any = await run(
      interceptor,
      mockCtx({ role: 'owner' }),
      {
        id: 'm1',
        full_name: 'Alice',
        face_descriptor: [0.1, 0.2, 0.3],
        face_embedding: [0.4, 0.5],
      },
    );
    expect(result.full_name).toBe('Alice');
    expect(result.face_descriptor).toBeUndefined();
    expect(result.face_embedding).toBeUndefined();
  });

  it('strips payment_method_token / card_token / cvv / password / password_hash / refresh_token', async () => {
    const result: any = await run(
      interceptor,
      mockCtx({ role: 'owner' }),
      {
        payment_method_token: 'pm_secret',
        card_token: 'tok_secret',
        cvv: '123',
        password: 'hunter2',
        password_hash: '$2b$...',
        refresh_token: 'r_token',
        amount: 500,
      },
    );
    expect(result.amount).toBe(500);
    expect(result.payment_method_token).toBeUndefined();
    expect(result.card_token).toBeUndefined();
    expect(result.cvv).toBeUndefined();
    expect(result.password).toBeUndefined();
    expect(result.password_hash).toBeUndefined();
    expect(result.refresh_token).toBeUndefined();
  });

  it('strips salary/base_salary/hourly_rate for NON-owner callers', async () => {
    const result: any = await run(
      interceptor,
      mockCtx({ role: 'receptionist' }),
      {
        full_name: 'Bob',
        salary: 50000,
        base_salary: 40000,
        hourly_rate: 500,
      },
    );
    expect(result.full_name).toBe('Bob');
    expect(result.salary).toBeUndefined();
    expect(result.base_salary).toBeUndefined();
    expect(result.hourly_rate).toBeUndefined();
  });

  it('KEEPS salary for owner / brand_owner callers', async () => {
    const asOwner: any = await run(
      interceptor,
      mockCtx({ role: 'owner' }),
      { full_name: 'Bob', salary: 50000 },
    );
    expect(asOwner.salary).toBe(50000);

    const asBrandOwner: any = await run(
      interceptor,
      mockCtx({ role: 'brand_owner' }),
      { full_name: 'Bob', salary: 50000 },
    );
    expect(asBrandOwner.salary).toBe(50000);
  });

  it('recurses into arrays and nested objects', async () => {
    const result: any = await run(
      interceptor,
      mockCtx({ role: 'owner' }),
      {
        data: [
          { id: 1, face_descriptor: [0.1], profile: { password: 'x', name: 'a' } },
          { id: 2, card_token: 'tok', profile: { name: 'b' } },
        ],
      },
    );
    expect(result.data[0].face_descriptor).toBeUndefined();
    expect(result.data[0].profile.password).toBeUndefined();
    expect(result.data[0].profile.name).toBe('a');
    expect(result.data[1].card_token).toBeUndefined();
    expect(result.data[1].profile.name).toBe('b');
  });

  it('does not touch response objects when headersSent is true (for @Res() endpoints)', async () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'owner' } }),
        getResponse: () => ({ headersSent: true }),
      }),
    } as any;

    const payload = { password: 'should-not-be-stripped' };
    const result: any = await run(interceptor, ctx, payload);
    expect(result.password).toBe('should-not-be-stripped');
  });

  it('does not recurse into Date / Buffer values', async () => {
    const now = new Date('2026-04-21T00:00:00Z');
    const buf = Buffer.from('bin');
    const result: any = await run(
      interceptor,
      mockCtx({ role: 'owner' }),
      { created_at: now, blob: buf, face_descriptor: [1] },
    );
    expect(result.created_at).toBe(now);
    expect(result.blob).toBe(buf);
    expect(result.face_descriptor).toBeUndefined();
  });

  it('is a no-op on null / primitive responses', async () => {
    expect(await run(interceptor, mockCtx({ role: 'owner' }), null)).toBeNull();
    expect(await run(interceptor, mockCtx({ role: 'owner' }), 42)).toBe(42);
    expect(await run(interceptor, mockCtx({ role: 'owner' }), 'hello')).toBe('hello');
  });
});
