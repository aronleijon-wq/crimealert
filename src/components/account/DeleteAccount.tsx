import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const CONFIRM_WORD = 'RADERA';

/** Deletes the account for good (delete-account), after the user types RADERA. Apple requires it in the app. */
const DeleteAccount = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error || !data?.deleted) throw new Error(data?.error ?? 'Kontot kunde inte raderas just nu.');
      await signOut().catch(() => {});
      setOpen(false);
      toast({ title: 'Ditt konto är raderat', description: 'Tack för att du använde CrimeAlert.' });
      navigate('/');
    } catch (err) {
      toast({ title: 'Kontot raderades inte', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setTyped(''); }}>
      <AlertDialogTrigger asChild>
        <button type="button" className="mx-auto flex items-center gap-1.5 text-[13px] text-[hsl(var(--ca-text-3))] underline-offset-4 transition hover:text-destructive hover:underline">
          <Trash2 className="h-3.5 w-3.5" aria-hidden /> Radera konto
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Radera ditt konto?</AlertDialogTitle>
          <AlertDialogDescription>
            Kontot, dina bevakade kommuner, notisinställningar, kommentarer och rapporter raderas för gott och kan inte återställas.
            Har du en prenumeration avslutas den direkt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="block text-sm text-foreground">
          Skriv <span className="font-mono font-semibold">{CONFIRM_WORD}</span> för att bekräfta
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 font-mono text-sm uppercase tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/40"
          />
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Avbryt</AlertDialogCancel>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy || typed.trim().toUpperCase() !== CONFIRM_WORD}
            className="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
          >
            {busy ? 'Raderar…' : 'Radera kontot'}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteAccount;
