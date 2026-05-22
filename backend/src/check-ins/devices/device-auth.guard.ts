// Intentionally left empty. Device authentication is handled by
// DeviceAuthMiddleware (see device-auth.middleware.ts) because middleware
// can wrap the rest of the request in an AsyncLocalStorage scope —
// guards can't (their canActivate return doesn't keep ALS alive for the
// handler).
export {};
