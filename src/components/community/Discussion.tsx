import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessagesSquare } from 'lucide-react';
import CommentThread from '@/components/feed/CommentThread';
import { useAuth } from '@/hooks/useAuth';

interface DiscussionProps {
  /** The thread: an event's id, or "kommun:nacka" (kommunThreadId) for a kommun's discussion */
  threadId: string;
  title: string;
  intro: string;
  /** Scroll here when the page opens, as a reply notification asks (?chatt=1) */
  focus?: boolean;
}

/**
 * Comments under an event or in a kommun's discussion. The same comments, moderation and reply
 * notifications as in the feed; reading them needs an account.
 */
const Discussion = ({ threadId, title, intro, focus = false }: DiscussionProps) => {
  const { user } = useAuth();
  const ref = useRef<HTMLElement>(null);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focus]);

  return (
    <section ref={ref} id="chatt" className="mt-10 scroll-mt-4 rounded-2xl border border-[hsl(var(--ca-line))] bg-card p-4" aria-labelledby={`${threadId}-chatt`}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <MessagesSquare className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id={`${threadId}-chatt`} className="text-base font-semibold text-foreground">
            {title}{count ? <span className="ml-1.5 text-sm font-normal text-muted-foreground">· {count}</span> : null}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{intro}</p>
        </div>
      </div>
      {user ? (
        <CommentThread itemId={threadId} onCountChange={setCount} />
      ) : (
        <p className="mt-4 border-t border-border pt-3 text-center text-sm text-muted-foreground">
          <Link to="/auth" className="font-semibold text-primary underline-offset-2 hover:underline">Logga in</Link> för att läsa och skriva. Det är gratis.
        </p>
      )}
    </section>
  );
};

export default Discussion;
