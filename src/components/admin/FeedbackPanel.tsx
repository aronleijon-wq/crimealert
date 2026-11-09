// "Tyck till" on /admin: the average and the latest answers, newest first.
import { useEffect, useState } from 'react';
import { MessageSquareHeart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { RATINGS } from '@/lib/feedback';

interface Row { id: number; created_at: string; rating: number; message: string | null; source: string }

const face = (rating: number) => RATINGS.find((r) => r.value === rating)?.face ?? '';

const FeedbackPanel = () => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    supabase.from('feedback').select('id, created_at, rating, message, source').order('created_at', { ascending: false }).limit(100)
      .then(({ data, error }) => { if (error) setFailed(true); else setRows(data ?? []); });
  }, []);

  const average = rows?.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : null;
  const counts = RATINGS.map((r) => ({ ...r, count: rows?.filter((row) => row.rating === r.value).length ?? 0 }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <MessageSquareHeart className="h-6 w-6 text-primary" />
          <div>
            <CardTitle className="text-xl">Tyck till</CardTitle>
            <CardDescription>Vad användarna tycker om CrimeAlert, de senaste 100 svaren</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {failed ? (
          <p className="text-sm text-muted-foreground">Kunde inte hämta svaren.</p>
        ) : rows === null ? (
          <p className="text-sm text-muted-foreground">Laddar…</p>
        ) : !rows.length ? (
          <p className="text-sm text-muted-foreground">Inga svar än.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="text-4xl font-bold tabular-nums">{average!.toFixed(1).replace('.', ',')}</p>
                <p className="text-sm text-muted-foreground">snitt av {rows.length} svar</p>
              </div>
              <div className="flex gap-4 text-sm tabular-nums">
                {counts.map((c) => <span key={c.value} title={c.label}>{c.face} {c.count}</span>)}
              </div>
            </div>
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="flex gap-3 py-3">
                  <span className="text-2xl leading-none" aria-label={`Betyg ${r.rating}`}>{face(r.rating)}</span>
                  <div className="min-w-0 flex-1">
                    {r.message ? <p className="whitespace-pre-wrap break-words text-sm">{r.message}</p> : <p className="text-sm italic text-muted-foreground">Ingen text</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' })} · {r.source}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default FeedbackPanel;
