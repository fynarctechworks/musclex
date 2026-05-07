# Performance Rules

## API
- Avoid unnecessary API calls — batch where possible
- Use pagination on all list endpoints
- Cache frequently-read, rarely-changed data (Redis)
- Target response times: dashboard < 2s, check-in < 1s, AI < 4s, member list < 1.5s

## Database
- Select only needed fields (no SELECT *)
- Index columns in WHERE/JOIN/ORDER BY clauses
- Use connection pooling (Supabase default)
- Avoid N+1 queries — use includes/joins

## Frontend
- Lazy load heavy components (calendar, charts, PDF renderer)
- Minimize re-renders — use React.memo, useMemo, useCallback where measured
- Use react-query for server state (auto-caching, deduplication)
- Prefetch routes the user is likely to visit next
- Optimize images: use next/image, compress uploads

## Bundle
- Code-split by route (Next.js default)
- Tree-shake unused exports
- Remove unused dependencies
- Monitor bundle size — flag increases > 50KB

## Monitoring
- Track Core Web Vitals (LCP, FID, CLS)
- Use Sentry for error tracking + performance traces
- Use PostHog for usage analytics
- Alert on P95 query time > 100ms
