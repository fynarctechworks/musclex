/**
 * Test-only mock for the ESM-only `jose` package.
 *
 * jose@6 ships as pure ESM (only `dist/webapi/index.js`), which Jest's
 * default CommonJS transform chokes on. Production code uses
 * `createRemoteJWKSet` + `jwtVerify` to validate Supabase JWTs on the
 * WebSocket gateway; none of our unit tests need real signature
 * verification, so we stub both with the smallest surface that the call
 * sites depend on.
 *
 * If a future test ever needs real JWT verification, write that test as
 * an e2e suite (which boots a real Nest module) and provide a CJS-aware
 * jest config there — or upgrade the project to ESM-native jest.
 */

export function createRemoteJWKSet(_url: URL): unknown {
  return { __mock: 'jwks' };
}

export async function jwtVerify(
  _token: string,
  _key: unknown,
  _opts?: Record<string, unknown>,
): Promise<{ payload: Record<string, unknown>; protectedHeader: Record<string, unknown> }> {
  return {
    payload: { sub: 'test-user', aud: 'authenticated' },
    protectedHeader: { alg: 'HS256' },
  };
}

export default {
  createRemoteJWKSet,
  jwtVerify,
};
