// "Tyck till": a rating from 1 to 5 and, if they want, a few words, through send_feedback
// (migration 20261109090000_feedback). Admins read it on /admin.
import { supabase } from '@/integrations/supabase/client';
import { isNativeApp, nativeAppVersion } from '@/lib/native';

export const FEEDBACK_MAX = 1000;

/** The five answers, worst first, with the face and the word a screen reader says */
export const RATINGS = [
  { value: 1, face: '😣', label: 'Dålig' },
  { value: 2, face: '🙁', label: 'Inte så bra' },
  { value: 3, face: '😐', label: 'Okej' },
  { value: 4, face: '🙂', label: 'Bra' },
  { value: 5, face: '😍', label: 'Toppen' },
] as const;

/** What to ask for in the text field, after the rating */
export const followUp = (rating: number) =>
  rating >= 5 ? 'Vad gillar du mest?' : rating >= 4 ? 'Vad skulle göra den ännu bättre?' : 'Vad ska vi göra bättre?';

/** "app 1.3" or "web": where the feedback came from */
export function feedbackSource(): string {
  if (!isNativeApp()) return 'web';
  const version = nativeAppVersion();
  return version ? `app ${version.join('.')}` : 'app';
}

export type FeedbackResult = 'ok' | 'too_many' | 'error';

export async function sendFeedback(rating: number, message: string): Promise<FeedbackResult> {
  const { data, error } = await supabase.rpc('send_feedback', {
    _rating: rating,
    _message: message.trim().slice(0, FEEDBACK_MAX),
    _source: feedbackSource(),
  });
  if (error) return 'error';
  return data === 'ok' ? 'ok' : data === 'too_many' ? 'too_many' : 'error';
}
