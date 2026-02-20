import { useState, useEffect } from 'react';
import { Star, MessageSquare, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Review {
  id: string;
  user_id: string;
  rating: number;
  message: string;
  display_name: string;
  created_at: string;
}

const StarRating = ({ rating, onRate, interactive = false }: { rating: number; onRate?: (r: number) => void; interactive?: boolean }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <button
        key={i}
        type="button"
        disabled={!interactive}
        onClick={() => onRate?.(i)}
        className={interactive ? 'cursor-pointer hover:scale-110 transition' : 'cursor-default'}
      >
        <Star
          className={`w-3.5 h-3.5 ${i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`}
        />
      </button>
    ))}
  </div>
);

const ReviewSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = async () => {
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setReviews((data as Review[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (rating === 0) {
      toast({ title: 'Välj betyg', description: 'Klicka på stjärnorna för att sätta betyg.', variant: 'destructive' });
      return;
    }
    if (!message.trim()) {
      toast({ title: 'Skriv ett omdöme', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('reviews').insert({
      user_id: user.id,
      rating,
      message: message.trim(),
      display_name: displayName.trim() || 'Anonym',
    });
    if (error) {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Tack för ditt omdöme!' });
      setRating(0);
      setMessage('');
      setDisplayName('');
      fetchReviews();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('reviews').delete().eq('id', id);
    fetchReviews();
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground">Omdömen</span>
        </div>
        {avgRating && (
          <div className="flex items-center gap-1.5">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-bold text-foreground">{avgRating}</span>
            <span className="text-[10px] text-muted-foreground">({reviews.length})</span>
          </div>
        )}
      </div>

      {/* Submit form */}
      {user ? (
        <form onSubmit={handleSubmit} className="space-y-2 mb-4 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Ditt betyg:</span>
            <StarRating rating={rating} onRate={setRating} interactive />
          </div>
          <input
            type="text"
            placeholder="Ditt namn (valfritt)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <textarea
            placeholder="Skriv ditt omdöme..."
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-50"
          >
            {submitting ? 'Skickar...' : 'Skicka omdöme'}
          </button>
        </form>
      ) : (
        <p className="text-[10px] text-muted-foreground mb-4 pb-4 border-b border-border">
          Logga in för att lämna ett omdöme.
        </p>
      )}

      {/* Reviews list */}
      {loading ? (
        <p className="text-[10px] text-muted-foreground">Laddar...</p>
      ) : reviews.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">Inga omdömen ännu. Bli först!</p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {reviews.map((r) => (
            <div key={r.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-foreground">{r.display_name}</span>
                  <StarRating rating={r.rating} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString('sv-SE')}
                  </span>
                  {user?.id === r.user_id && (
                    <button onClick={() => handleDelete(r.id)} className="text-muted-foreground hover:text-destructive transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">{r.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewSection;
