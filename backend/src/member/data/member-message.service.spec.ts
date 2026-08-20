import { MemberMessageService } from './member-message.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/**
 * A DM is the first place a stranger can put text in front of somebody who did
 * not ask for it. These cover the three guards — block, the recipient's own
 * privacy rule, and reporting — plus the one structural detail that decides
 * whether threads work at all: one conversation per pair.
 */
describe('MemberMessageService', () => {
  const me: CurrentMemberContext = {
    appUserId: 'aaa', memberId: 'm', tenantId: 't', isGymMember: true,
  };
  const THEM = 'zzz'; // sorts after 'aaa', so the ordered pair is (aaa, zzz)

  let pub: any;
  let service: MemberMessageService;

  beforeEach(() => {
    pub = {
      appUser: {
        findUnique: jest.fn().mockResolvedValue({ id: THEM, message_privacy: 'everyone' }),
        update: jest.fn().mockResolvedValue({}),
      },
      follow: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      block: { findMany: jest.fn().mockResolvedValue([]) },
      conversation: {
        upsert: jest.fn().mockResolvedValue({ id: 'c1' }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'c1', member_a_id: 'aaa', member_b_id: THEM,
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      directMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'm1', body: 'hello', created_at: new Date(),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      conversationRead: { upsert: jest.fn().mockResolvedValue({}) },
      report: { create: jest.fn().mockResolvedValue({ id: 'r1' }) },
    };
    service = new MemberMessageService(pub as any);
  });

  describe('one conversation per pair', () => {
    it('stores the pair ordered so two simultaneous opens cannot split a thread', async () => {
      await service.open(me, THEM);
      const where = pub.conversation.upsert.mock.calls[0][0].where;
      expect(where.member_a_id_member_b_id).toEqual({ member_a_id: 'aaa', member_b_id: THEM });
    });

    it('orders the pair the same way whoever opens it', async () => {
      const them: CurrentMemberContext = { ...me, appUserId: THEM };
      pub.appUser.findUnique.mockResolvedValue({ id: 'aaa', message_privacy: 'everyone' });
      await service.open(them, 'aaa');
      const where = pub.conversation.upsert.mock.calls[0][0].where;
      expect(where.member_a_id_member_b_id).toEqual({ member_a_id: 'aaa', member_b_id: THEM });
    });

    it('refuses a thread with yourself', async () => {
      await expect(service.open(me, 'aaa')).rejects.toThrow(/yourself/i);
    });
  });

  describe('the guards', () => {
    it('refuses when blocked, and does not reveal that a block exists', async () => {
      pub.block.findMany.mockResolvedValue([{ blocker_id: THEM, blocked_id: 'aaa' }]);
      // "Not found", never "you are blocked" — otherwise the refusal itself
      // tells them.
      await expect(service.open(me, THEM)).rejects.toThrow(/not found/i);
    });

    it('honours a closed inbox', async () => {
      pub.appUser.findUnique.mockResolvedValue({ id: THEM, message_privacy: 'nobody' });
      await expect(service.open(me, THEM)).rejects.toThrow(/not accepting/i);
    });

    it('followers-only means THEY follow ME, not the other way round', async () => {
      // The recipient chose whose messages they want, so it is their list.
      pub.appUser.findUnique.mockResolvedValue({ id: THEM, message_privacy: 'followers' });
      pub.follow.findFirst.mockResolvedValue(null);
      await expect(service.open(me, THEM)).rejects.toThrow(/only accepts messages/i);

      pub.follow.findFirst.mockResolvedValue({ id: 'f1' });
      await expect(service.open(me, THEM)).resolves.toMatchObject({ id: 'c1' });
      expect(pub.follow.findFirst.mock.calls[1][0].where).toEqual({
        follower_id: THEM, followee_id: 'aaa',
      });
    });

    it('re-checks on every send, not just when the thread opened', async () => {
      // A block or a privacy change after the fact has to bite immediately.
      pub.appUser.findUnique.mockResolvedValue({ id: THEM, message_privacy: 'nobody' });
      await expect(service.send(me, 'c1', 'hi')).rejects.toThrow(/not accepting/i);
      expect(pub.directMessage.create).not.toHaveBeenCalled();
    });

    it('hides a blocked person\'s thread from the inbox', async () => {
      pub.block.findMany.mockResolvedValue([{ blocker_id: 'aaa', blocked_id: 'troll' }]);
      await service.list(me);
      const where = pub.conversation.findMany.mock.calls[0][0].where;
      expect(where.AND).toEqual([
        { member_a_id: { notIn: ['troll'] } },
        { member_b_id: { notIn: ['troll'] } },
      ]);
    });

    it('refuses to open a thread belonging to someone else', async () => {
      pub.conversation.findFirst.mockResolvedValue(null);
      await expect(service.messages(me, 'not-mine')).rejects.toThrow(/not found/i);
    });
  });

  describe('sending', () => {
    it('rejects an empty message', async () => {
      await expect(service.send(me, 'c1', '   ')).rejects.toThrow(/write something/i);
    });

    it('rejects one past the cap', async () => {
      await expect(service.send(me, 'c1', 'x'.repeat(2001))).rejects.toThrow(/2000/);
    });

    it('moves the thread to the top of the inbox', async () => {
      await service.send(me, 'c1', 'hello');
      expect(pub.conversation.update.mock.calls[0][0].data.last_message_at).toBeInstanceOf(Date);
    });

    it('only the sender may retract, and only their own', async () => {
      pub.directMessage.findUnique.mockResolvedValue({
        id: 'm1', sender_id: THEM, deleted_at: null,
      });
      await expect(service.deleteMessage(me, 'm1')).rejects.toThrow(/not found/i);

      pub.directMessage.findUnique.mockResolvedValue({
        id: 'm1', sender_id: 'aaa', deleted_at: null,
      });
      await expect(service.deleteMessage(me, 'm1')).resolves.toEqual({ deleted: true });
    });
  });

  describe('unread', () => {
    it('never counts your own messages as unread to you', async () => {
      pub.conversation.findMany.mockResolvedValue([{
        id: 'c1', member_a_id: 'aaa', member_b_id: THEM,
        member_a: { id: 'aaa', full_name: 'Me' },
        member_b: { id: THEM, full_name: 'Them' },
        reads: [{ last_read_at: new Date(0) }],
        messages: [],
      }]);
      await service.list(me);
      expect(pub.directMessage.count.mock.calls[0][0].where.sender_id).toEqual({ not: 'aaa' });
    });

    it('marks the thread read simply by opening it', async () => {
      await service.messages(me, 'c1');
      expect(pub.conversationRead.upsert).toHaveBeenCalled();
    });
  });

  describe('reporting', () => {
    it('is available without blocking first — two different decisions', async () => {
      const out = await service.report(me, {
        targetKind: 'message', targetId: 'm1', reportedId: THEM, reason: 'harassment',
      } as any);
      expect(out.reported).toBe(true);
      expect(pub.report.create.mock.calls[0][0].data.reporter_id).toBe('aaa');
    });

    it('records who was reported, so the report survives the content being deleted', async () => {
      await service.report(me, {
        targetKind: 'comment', targetId: 'c9', reportedId: THEM, reason: 'abuse',
      } as any);
      expect(pub.report.create.mock.calls[0][0].data.reported_id).toBe(THEM);
    });
  });

  describe('message privacy', () => {
    it('records the member\'s own choice', async () => {
      await service.setMessagePrivacy(me, 'nobody');
      expect(pub.appUser.update.mock.calls[0][0].data.message_privacy).toBe('nobody');
      expect(pub.appUser.update.mock.calls[0][0].where.id).toBe('aaa');
    });
  });
});
