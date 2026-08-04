import { MemberCoachService } from '../../src/member/data/member-coach.service';
import { MemberException } from '../../src/member/common/member-exception';

describe('MemberCoachService', () => {
  const member = {
    appUserId: 'au-1',
    memberId: 'm-1',
    tenantId: '55555555-5555-5555-5555-555555555555',
    isGymMember: true,
  } as any;

  function makeService(opts: { conversation?: any } = {}) {
    const client = {
      memberAiConversation: {
        findFirst: jest.fn().mockResolvedValue(opts.conversation ?? null),
        create: jest.fn().mockResolvedValue({ id: 'conv-1', messages: [] }),
        update: jest.fn().mockResolvedValue({}),
      },
      member: { findFirst: jest.fn().mockResolvedValue({ full_name: 'Asha', gender: null, profile: null }) },
      assignedDietPlan: { findFirst: jest.fn().mockResolvedValue(null) },
      assignedWorkout: { findFirst: jest.fn().mockResolvedValue(null) },
      workoutLog: { count: jest.fn().mockResolvedValue(2) },
      nutritionGoal: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    // No ANTHROPIC_API_KEY → fallback responses (no network).
    const config = { get: jest.fn().mockReturnValue(undefined) } as any;
    const service = new MemberCoachService({ client } as any, config);
    return { service, client };
  }

  it('rejects public (gym-less) users', async () => {
    const { service } = makeService();
    await expect(service.chat({ ...member, memberId: null }, 'hi')).rejects.toThrow(MemberException);
  });

  it('creates a rolling conversation on first message and persists both turns', async () => {
    const { service, client } = makeService();
    const result = await service.chat(member, 'How do I build muscle?');

    expect(client.memberAiConversation.create).toHaveBeenCalledWith({
      data: { gym_id: member.tenantId, member_id: 'm-1', messages: [] },
    });
    expect(result.conversation_id).toBe('conv-1');
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({ role: 'user', content: 'How do I build muscle?' });
    expect(result.messages[1].role).toBe('assistant');
    expect(result.response.length).toBeGreaterThan(0);

    const updateArg = (client.memberAiConversation.update as jest.Mock).mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'conv-1' });
    expect(updateArg.data.messages).toHaveLength(2);
  });

  it('appends to the existing conversation history', async () => {
    const history = [
      { role: 'user', content: 'q1', timestamp: 't1' },
      { role: 'assistant', content: 'a1', timestamp: 't2' },
    ];
    const { service, client } = makeService({ conversation: { id: 'conv-9', messages: history } });
    const result = await service.chat(member, 'q2');
    expect(client.memberAiConversation.create).not.toHaveBeenCalled();
    expect(result.messages).toHaveLength(4);
  });

  it('getConversation returns empty for public users and history for members', async () => {
    const { service } = makeService({
      conversation: { id: 'conv-2', messages: [{ role: 'user', content: 'x', timestamp: 't' }] },
    });
    expect(await service.getConversation({ ...member, memberId: null })).toEqual({
      conversation_id: null,
      messages: [],
    });
    expect(await service.getConversation(member)).toEqual({
      conversation_id: 'conv-2',
      messages: [{ role: 'user', content: 'x', timestamp: 't' }],
    });
  });
});
