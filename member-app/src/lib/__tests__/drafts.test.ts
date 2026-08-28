import { clearDraft, draftKey, hasDraft, readDraft, writeDraft } from '../drafts';

describe('drafts', () => {
  const key = draftKey('comment', 'activity-1');

  afterEach(() => clearDraft(key));

  it('returns an empty string when nothing is stored', () => {
    expect(readDraft(key)).toBe('');
  });

  it('round-trips a draft', () => {
    writeDraft(key, 'nice run');
    expect(readDraft(key)).toBe('nice run');
  });

  it('namespaces by scope and id so boxes cannot read each other', () => {
    writeDraft(draftKey('comment', 'a'), 'for a');
    writeDraft(draftKey('comment', 'b'), 'for b');
    expect(readDraft(draftKey('comment', 'a'))).toBe('for a');
    expect(readDraft(draftKey('comment', 'b'))).toBe('for b');
    clearDraft(draftKey('comment', 'a'));
    clearDraft(draftKey('comment', 'b'));
  });

  it('treats an empty write as a clear, leaving nothing behind', () => {
    writeDraft(key, 'typed then deleted');
    expect(hasDraft(key)).toBe(true);
    writeDraft(key, '');
    // Not merely reading back as '' — the entry must be GONE, or a cleared box
    // leaves a stored empty string that outlives what it belonged to.
    expect(hasDraft(key)).toBe(false);
    expect(readDraft(key)).toBe('');
  });

  it('clears a draft once it has been sent', () => {
    writeDraft(key, 'about to post');
    clearDraft(key);
    expect(readDraft(key)).toBe('');
  });
});
