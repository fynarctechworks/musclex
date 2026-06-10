import { BadRequestException } from '@nestjs/common';
import * as supa from '@supabase/supabase-js';
import { MemberProgressPhotoService } from './member-progress-photo.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

// Mock the Supabase client. Stable `from`/`storage` mocks are exposed on the
// module so tests can configure return values and assert calls.
jest.mock('@supabase/supabase-js', () => {
  const from = {
    createSignedUploadUrl: jest.fn(),
    list: jest.fn(),
  };
  const storage = {
    listBuckets: jest.fn().mockResolvedValue({ data: [{ name: 'member-photos' }] }),
    createBucket: jest.fn(),
    from: jest.fn(() => from),
  };
  return {
    createClient: jest.fn(() => ({ storage })),
    __from: from,
    __storage: storage,
  };
});

const UUID = '11111111-1111-1111-1111-111111111111';

describe('MemberProgressPhotoService', () => {
  const member: CurrentMemberContext = {
    appUserId: 'auA',
    memberId: 'mA',
    tenantId: 'tA',
    isGymMember: true,
  };
  const sfrom = (supa as any).__from;
  let prisma: any;
  let audit: any;
  let service: MemberProgressPhotoService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = { memberProgressPhoto: { create: jest.fn() } };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    const config = { get: jest.fn().mockReturnValue('') } as any;
    service = new MemberProgressPhotoService(config, prisma, audit);
  });

  it('createUploadUrl returns a uuid photoId + signed URL scoped to the member', async () => {
    sfrom.createSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/put' },
      error: null,
    });

    const res = await service.createUploadUrl(member);

    expect(res.uploadUrl).toBe('https://signed.example/put');
    expect(res.photoId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(sfrom.createSignedUploadUrl).toHaveBeenCalledWith(`tA/mA/${res.photoId}`);
  });

  it('confirm rejects a non-uuid photoId (path-traversal guard)', async () => {
    await expect(service.confirm(member, '../../etc/passwd', '2026-06-07T00:00:00Z')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.memberProgressPhoto.create).not.toHaveBeenCalled();
  });

  it('confirm rejects when the object was never uploaded', async () => {
    sfrom.list.mockResolvedValue({ data: [] });

    await expect(service.confirm(member, UUID, '2026-06-07T00:00:00Z')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.memberProgressPhoto.create).not.toHaveBeenCalled();
  });

  it('confirm persists a member-scoped row when the upload exists', async () => {
    sfrom.list.mockResolvedValue({ data: [{ name: UUID }] });
    prisma.memberProgressPhoto.create.mockResolvedValue({
      id: 'p1',
      photo_url: `tA/mA/${UUID}`,
      taken_at: new Date('2026-06-07T00:00:00.000Z'),
    });

    const res = await service.confirm(member, UUID, '2026-06-07T00:00:00Z');

    expect(prisma.memberProgressPhoto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gym_id: 'tA',
        member_id: 'mA',
        photo_url: `tA/mA/${UUID}`,
        photo_type: 'progress',
      }),
    });
    expect(res).toMatchObject({ id: 'p1', url: `tA/mA/${UUID}` });
  });
});
