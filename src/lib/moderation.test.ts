import { describe, it, expect, vi, beforeEach } from 'vitest';

const insert = vi.fn();
const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ insert: (row: unknown) => insert(row) }), rpc: (name: string, args: unknown) => rpc(name, args) },
}));

const { BLOCKED_WORDS_MESSAGE, POSTING_BANNED_MESSAGE, blockReportAuthor, blockUser, communityReportId, hasBlockedWords, isBlockedWordsError, refusalMessage, reportContent } = await import('./moderation');

describe('moderation', () => {
  beforeEach(() => {
    insert.mockReset().mockResolvedValue({ error: null });
    rpc.mockReset().mockResolvedValue({ error: null });
  });

  it('refuses slurs but not ordinary words that contain the same letters', () => {
    expect(hasBlockedWords('din BLATTE')).toBe(true);
    expect(hasBlockedWords('kys')).toBe(true);
    expect(hasBlockedWords('Negativ utveckling, en kyss och svart skal')).toBe(false);
    expect(hasBlockedWords('Polisen var på plats vid niotiden')).toBe(false);
  });

  it('reports a post once, and a second report of the same post is not an error', async () => {
    await reportContent('u1', 'comment', 'c1', 'spam');
    expect(insert).toHaveBeenCalledWith({ reporter_id: 'u1', target_type: 'comment', target_id: 'c1', reason: 'spam' });
    insert.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } });
    await expect(reportContent('u1', 'comment', 'c1', 'spam')).resolves.toBeUndefined();
    insert.mockResolvedValue({ error: { code: '42501', message: 'denied' } });
    await expect(reportContent('u1', 'comment', 'c1', 'spam')).rejects.toBeTruthy();
  });

  it('blocks authors, a report’s author without knowing who it is', async () => {
    await blockUser('u1', 'u2');
    expect(insert).toHaveBeenCalledWith({ blocker_id: 'u1', blocked_id: 'u2' });
    await blockUser('u1', 'u1');
    expect(insert).toHaveBeenCalledTimes(1);
    await blockReportAuthor('r1');
    expect(rpc).toHaveBeenCalledWith('block_report_author', { _report_id: 'r1' });
  });

  it('knows citizen reports on the map and the slur check’s error', () => {
    expect(communityReportId('cr-123')).toBe('123');
    expect(communityReportId('polisen-1')).toBeNull();
    expect(isBlockedWordsError({ message: 'blocked_words' })).toBe(true);
    expect(isBlockedWordsError(null)).toBe(false);
  });

  it('explains why the database refused a post, and only then', () => {
    expect(refusalMessage({ message: 'blocked_words' })).toBe(BLOCKED_WORDS_MESSAGE);
    expect(refusalMessage({ message: 'posting_banned' })).toBe(POSTING_BANNED_MESSAGE);
    expect(refusalMessage({ message: 'timeout' })).toBeNull();
    expect(refusalMessage(null)).toBeNull();
  });
});
