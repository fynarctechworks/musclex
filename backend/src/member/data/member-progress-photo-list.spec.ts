import { MemberProgressPhotoService } from './member-progress-photo.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

// The service builds its own Supabase client in the constructor, so the module
// is mocked rather than the client injected — the same approach the sibling
// spec for this service already takes.
jest.mock('@supabase/supabase-js', () => {
  const bucket = { createSignedUrls: jest.fn() };
  const storage = {
    listBuckets: jest.fn().mockResolvedValue({ data: [{ name: 'member-photos' }] }),
    from: jest.fn(() => bucket),
  };
  return { createClient: jest.fn(() => ({ storage })), __bucket: bucket, __storage: storage };
});
// eslint-disable-next-line @typescript-eslint/no-var-requires
const supa = require('@supabase/supabase-js');

/**
 * Progress photos are among the most personal things this product stores.
 * These cover the two rules that matter: a member only ever sees their own,
 * and what leaves the server is a short-lived signed URL rather than a path.
 */
describe('MemberProgressPhotoService.list', () => {
  const me: CurrentMemberContext = {
    appUserId: 'au', memberId: 'm1', tenantId: 't1', isGymMember: true,
  };

  let tenant: any;
  let service: MemberProgressPhotoService;

  const rows = [
    { id: 'p1', photo_url: 'gym/m1/p1.jpg', taken_at: new Date('2026-08-20T00:00:00Z') },
    { id: 'p2', photo_url: 'gym/m1/p2.jpg', taken_at: new Date('2026-08-10T00:00:00Z') },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    tenant = { client: { memberProgressPhoto: { findMany: jest.fn().mockResolvedValue(rows) } } };
    supa.__storage.from.mockReturnValue(supa.__bucket);
    supa.__bucket.createSignedUrls.mockResolvedValue({
      data: [
        { path: 'gym/m1/p1.jpg', signedUrl: 'https://signed/p1?token=x' },
        { path: 'gym/m1/p2.jpg', signedUrl: 'https://signed/p2?token=y' },
      ],
      error: null,
    });
    const config = { get: jest.fn().mockReturnValue('https://example.supabase.co') } as any;
    service = new MemberProgressPhotoService(config, tenant as any, { log: jest.fn() } as any);
  });

  it('reads only the caller\'s own photos', async () => {
    await service.list(me);
    expect(tenant.client.memberProgressPhoto.findMany.mock.calls[0][0].where).toEqual({
      member_id: 'm1',
    });
  });

  it('returns newest first', async () => {
    await service.list(me);
    expect(tenant.client.memberProgressPhoto.findMany.mock.calls[0][0].orderBy).toEqual({
      taken_at: 'desc',
    });
  });

  it('hands back signed URLs, never the stored object path', async () => {
    const out = await service.list(me);
    expect(out.photos[0].url).toBe('https://signed/p1?token=x');
    expect(JSON.stringify(out)).not.toContain('gym/m1/');
  });

  it('signs for one hour, so a shared link stops working', async () => {
    await service.list(me);
    expect(supa.__bucket.createSignedUrls.mock.calls[0][1]).toBe(3600);
  });

  it('gives null rather than a path when signing fails', async () => {
    // A path is not a URL; returning one renders a broken image containing an
    // internal storage location.
    supa.__bucket.createSignedUrls.mockResolvedValue({ data: null, error: { message: 'nope' } });
    const out = await service.list(me);
    expect(out.photos.every((p) => p.url === null)).toBe(true);
  });

  it('does not call storage at all when there are no photos', async () => {
    tenant.client.memberProgressPhoto.findMany.mockResolvedValue([]);
    expect(await service.list(me)).toEqual({ photos: [] });
    expect(supa.__storage.from).not.toHaveBeenCalled();
  });

  it('caps the page size however large a limit is asked for', async () => {
    await service.list(me, 100000);
    expect(tenant.client.memberProgressPhoto.findMany.mock.calls[0][0].take).toBe(200);
  });
});
