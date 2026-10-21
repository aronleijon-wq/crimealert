import { useCallback, useEffect, useState } from 'react';
import { UserX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { unblockReportAuthor, unblockUser } from '@/lib/moderation';

interface Blocked {
  key: string;
  label: string;
  unblock: () => Promise<void>;
}

/**
 * The people the user has blocked, to unblock again. Authors of citizen reports stay anonymous:
 * they are listed by the report they were blocked from.
 */
const BlockedUsers = ({ userId }: { userId: string }) => {
  const { toast } = useToast();
  const [blocked, setBlocked] = useState<Blocked[] | null>(null);

  const load = useCallback(async () => {
    const [{ data: people }, { data: reports }] = await Promise.all([
      supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId),
      supabase.rpc('my_report_blocks'),
    ]);
    const ids = (people ?? []).map((p) => p.blocked_id);
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('id, display_name').in('id', ids)
      : { data: [] };
    const names = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.display_name]));
    setBlocked([
      ...ids.map((id) => ({ key: id, label: names[id] || 'Utan namn', unblock: () => unblockUser(userId, id) })),
      ...(reports ?? []).map((r) => ({
        key: r.report_id,
        label: `Skribenten av en medborgarrapport (${new Date(r.created_at).toLocaleDateString('sv-SE')})`,
        unblock: () => unblockReportAuthor(r.report_id),
      })),
    ]);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const unblock = async (item: Blocked) => {
    try {
      await item.unblock();
      setBlocked((prev) => prev?.filter((b) => b.key !== item.key) ?? null);
    } catch {
      toast({ title: 'Det gick inte', description: 'Försök igen om en stund.', variant: 'destructive' });
    }
  };

  return (
    <div className="flex min-h-[56px] w-full items-start gap-3 px-4 py-3">
      <UserX className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--ca-text-2))]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-foreground">Blockerade</p>
        {!blocked?.length ? (
          <p className="mt-0.5 text-[13px] leading-snug text-[hsl(var(--ca-text-2))]">
            Ingen. Tryck på flaggan vid en kommentar eller rapport för att anmäla den eller blockera skribenten.
          </p>
        ) : (
          <ul className="mt-1 space-y-1">
            {blocked.map((b) => (
              <li key={b.key} className="flex items-center justify-between gap-2 text-[13px] text-[hsl(var(--ca-text-2))]">
                <span className="min-w-0 truncate">{b.label}</span>
                <button type="button" onClick={() => unblock(b)} className="shrink-0 font-semibold text-primary hover:underline">
                  Häv
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default BlockedUsers;
