// Moderation of what users write (comments and citizen reports), as Apple requires of apps with
// user content: report a post, block its author, and slurs refused before they are posted.
// The database does the same (migration 20261020200000_moderation): reported and blocked posts
// disappear for the one who reported or blocked them, and for everyone after three reports.
import { supabase } from '@/integrations/supabase/client';

export type ReportTarget = 'comment' | 'community_report';
export type ReportReason = 'offensive' | 'threat' | 'spam' | 'false' | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'offensive', label: 'Kränkande' },
  { value: 'threat', label: 'Hot eller hat' },
  { value: 'spam', label: 'Spam' },
  { value: 'false', label: 'Falsk uppgift' },
  { value: 'other', label: 'Annat' },
];

// Same list as public.has_blocked_words
const BLOCKED_WORDS =
  /(^|[^a-zåäö])(n[i1]gg(er|a|ah|ers|as)?|negr(er|ern|erna)|svartskall(e|en|ar|arna)?|blatt(e|en|ar|arna)|zigenarjävl(ar|arna)?|bögjävl(ar|arna)?|fagg?ots?|kill yourself|kys)([^a-zåäö]|$)/;

export const hasBlockedWords = (text: string) => BLOCKED_WORDS.test(text.toLowerCase());

export const BLOCKED_WORDS_MESSAGE = 'Texten innehåller ord som inte är tillåtna på CrimeAlert.';

/** Whether a database error is the slur check refusing a post */
export const isBlockedWordsError = (error: { message?: string } | null | undefined) => !!error?.message?.includes('blocked_words');

export const POSTING_BANNED_MESSAGE = 'Ditt konto kan inte längre skriva på CrimeAlert, efter en anmälan som vi har granskat.';

/** Why the database refused a post, in words for the writer; null when it wasn't moderation */
export const refusalMessage = (error: { message?: string } | null | undefined) =>
  isBlockedWordsError(error) ? BLOCKED_WORDS_MESSAGE : error?.message?.includes('posting_banned') ? POSTING_BANNED_MESSAGE : null;

export async function reportContent(reporterId: string, targetType: ReportTarget, targetId: string, reason: ReportReason) {
  const { error } = await supabase.from('content_reports').insert({ reporter_id: reporterId, target_type: targetType, target_id: targetId, reason });
  // Reporting the same post twice is fine: it is already reported
  if (error && error.code !== '23505') throw error;
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) return;
  const { error } = await supabase.from('user_blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error && error.code !== '23505') throw error;
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
  if (error) throw error;
}

/** Blocks a citizen report's author without learning who it is (reports are anonymous). */
export async function blockReportAuthor(reportId: string) {
  const { error } = await supabase.rpc('block_report_author', { _report_id: reportId });
  if (error) throw error;
}

export async function unblockReportAuthor(reportId: string) {
  const { error } = await supabase.rpc('unblock_report_author', { _report_id: reportId });
  if (error) throw error;
}

/** "cr-<uuid>" on the map is citizen report <uuid> */
export const communityReportId = (incidentId: string) => (incidentId.startsWith('cr-') ? incidentId.slice(3) : null);
