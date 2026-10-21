import { useCallback, useEffect, useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { REPORT_REASONS, type ReportTarget } from '@/lib/moderation';

/** One reported post with all its open reports */
interface Flagged {
  type: ReportTarget;
  id: string;
  reasons: Record<string, number>;
  firstAt: string;
  /** null when the post is already gone */
  text: string | null;
  authorId: string | null;
}

interface Ban {
  user_id: string;
  created_at: string;
}

const REASON_LABELS: Record<string, string> = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label]));
const TABLES = { comment: 'incident_comments', community_report: 'community_reports' } as const;

const ago = (iso: string) => {
  const hours = Math.floor((Date.now() - Date.parse(iso)) / 3600000);
  return hours < 1 ? 'nyss' : hours < 48 ? `${hours} h sedan` : `${Math.floor(hours / 24)} d sedan`;
};

/**
 * Reported comments and citizen reports, for an admin to remove or dismiss. Apple asks that
 * reports are handled within 24 hours, so the oldest comes first. Three reports already hide a
 * post from everyone until it is handled here.
 */
const ModerationPanel = () => {
  const [items, setItems] = useState<Flagged[] | null>(null);
  const [bans, setBans] = useState<Ban[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: reports }, { data: banRows }] = await Promise.all([
      supabase.from('content_reports').select('target_type, target_id, reason, created_at').eq('status', 'open').order('created_at').limit(500),
      supabase.from('posting_bans').select('user_id, created_at').order('created_at', { ascending: false }),
    ]);

    const grouped = new Map<string, Flagged>();
    (reports ?? []).forEach((r) => {
      const key = `${r.target_type}:${r.target_id}`;
      const item = grouped.get(key) ?? { type: r.target_type as ReportTarget, id: r.target_id, reasons: {}, firstAt: r.created_at, text: null, authorId: null };
      item.reasons[r.reason] = (item.reasons[r.reason] ?? 0) + 1;
      grouped.set(key, item);
    });
    const flagged = [...grouped.values()];

    const ids = (type: ReportTarget) => flagged.filter((f) => f.type === type).map((f) => f.id);
    const [{ data: comments }, { data: citizenReports }] = await Promise.all([
      ids('comment').length ? supabase.from('incident_comments').select('id, text, user_id').in('id', ids('comment')) : Promise.resolve({ data: [] }),
      ids('community_report').length
        ? supabase.from('community_reports').select('id, title, description, user_id').in('id', ids('community_report'))
        : Promise.resolve({ data: [] }),
    ]);
    (comments ?? []).forEach((c) => {
      const item = grouped.get(`comment:${c.id}`);
      if (item) { item.text = c.text; item.authorId = c.user_id; }
    });
    (citizenReports ?? []).forEach((r) => {
      const item = grouped.get(`community_report:${r.id}`);
      if (item) { item.text = `${r.title}: ${r.description}`; item.authorId = r.user_id; }
    });

    const people = [...new Set([...flagged.map((f) => f.authorId), ...(banRows ?? []).map((b) => b.user_id)].filter((id): id is string => !!id))];
    if (people.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', people);
      setNames(Object.fromEntries((profiles ?? []).map((p) => [p.id, p.display_name ?? ''])));
    }
    setItems(flagged);
    setBans(banRows ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const closeReports = async (item: Flagged, status: 'removed' | 'dismissed') => {
    const { error } = await supabase.from('content_reports').update({ status })
      .eq('target_type', item.type).eq('target_id', item.id).eq('status', 'open');
    if (error) throw error;
  };

  const act = async (item: Flagged, action: 'dismiss' | 'remove' | 'ban') => {
    setBusy(`${item.type}:${item.id}`);
    try {
      if (action === 'dismiss') {
        await closeReports(item, 'dismissed');
        toast.success('Anmälan avfärdad. Inlägget syns igen.');
      } else {
        if (item.text !== null) {
          const { error } = await supabase.from(TABLES[item.type]).delete().eq('id', item.id);
          if (error) throw error;
        }
        await closeReports(item, 'removed');
        if (action === 'ban' && item.authorId) {
          const { error } = await supabase.from('posting_bans').insert({ user_id: item.authorId, target_id: item.id });
          if (error && error.code !== '23505') throw error;
        }
        toast.success(action === 'ban' ? 'Borttaget, och skribenten kan inte skriva mer.' : 'Inlägget är borttaget.');
      }
      await load();
    } catch {
      toast.error('Det gick inte. Försök igen.');
    } finally {
      setBusy(null);
    }
  };

  const liftBan = async (userId: string) => {
    const { error } = await supabase.from('posting_bans').delete().eq('user_id', userId);
    if (error) toast.error('Det gick inte. Försök igen.');
    else setBans((prev) => prev.filter((b) => b.user_id !== userId));
  };

  const name = (id: string | null) => (id ? names[id] || 'Utan namn' : 'okänd');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Flag className="h-6 w-6 text-destructive" aria-hidden />
          <div>
            <CardTitle className="text-xl">Anmälda inlägg</CardTitle>
            <CardDescription>Hantera inom 24 timmar. Tre anmälningar döljer ett inlägg för alla tills det är hanterat.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items === null ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga öppna anmälningar.</p>
        ) : (
          items.map((item) => {
            const key = `${item.type}:${item.id}`;
            const count = Object.values(item.reasons).reduce((a, b) => a + b, 0);
            return (
              <div key={key} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{item.type === 'comment' ? 'Kommentar' : 'Medborgarrapport'}</span>
                  <span>av {name(item.authorId)}</span>
                  <span>· {count} {count === 1 ? 'anmälan' : 'anmälningar'}, första {ago(item.firstAt)}</span>
                  <span>· {Object.entries(item.reasons).map(([r, n]) => `${REASON_LABELS[r] ?? r}${n > 1 ? ` ×${n}` : ''}`).join(', ')}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                  {item.text ?? <span className="italic text-muted-foreground">Redan borttaget av skribenten.</span>}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="destructive" disabled={busy === key} onClick={() => act(item, 'remove')}>Ta bort</Button>
                  {item.authorId && (
                    <Button size="sm" variant="destructive" disabled={busy === key} onClick={() => act(item, 'ban')}>Ta bort och stäng av skribenten</Button>
                  )}
                  <Button size="sm" variant="outline" disabled={busy === key} onClick={() => act(item, 'dismiss')}>Avfärda</Button>
                </div>
              </div>
            );
          })
        )}

        {bans.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-sm font-semibold">Avstängda från att skriva</p>
            <ul className="mt-2 space-y-1">
              {bans.map((b) => (
                <li key={b.user_id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{name(b.user_id)} <span className="text-xs text-muted-foreground">sedan {ago(b.created_at)}</span></span>
                  <Button size="sm" variant="ghost" onClick={() => liftBan(b.user_id)}>Häv</Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ModerationPanel;
