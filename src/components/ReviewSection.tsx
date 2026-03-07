import { useState, useEffect } from 'react';
import { Star, MessageSquare, Trash2, Quote, UserCircle } from 'lucide-react';
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

const StarRating = ({ rating, onRate, interactive = false, size = 'sm' }: { rating: number; onRate?: (r: number) => void; interactive?: boolean; size?: 'sm' | 'md' }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <button
        key={i}
        type="button"
        disabled={!interactive}
        onClick={() => onRate?.(i)}
        className={interactive ? 'cursor-pointer hover:scale-125 transition-transform' : 'cursor-default'}
      >
        <Star
          className={`${size === 'md' ? 'w-5 h-5' : 'w-3.5 h-3.5'} transition-colors ${i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/20'}`}
        />
      </button>
    ))}
  </div>
);

const getInitials = (name: string) => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const avatarColors = [
  'from-primary/80 to-primary/40',
  'from-[hsl(var(--cr-blue))]/80 to-[hsl(var(--cr-blue))]/40',
  'from-[hsl(var(--cr-green))]/80 to-[hsl(var(--cr-green))]/40',
  'from-[hsl(var(--cr-orange))]/80 to-[hsl(var(--cr-orange))]/40',
  'from-purple-500/80 to-purple-500/40',
];

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

const timeAgoShort = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h sedan`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d sedan`;
  return new Date(dateStr).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
};

const ReviewCard = ({ review, canDelete, onDelete }: { review: Review; canDelete: boolean; onDelete: () => void }) => (
  <div className="group relative bg-muted/30 hover:bg-muted/50 border border-border/50 rounded-xl p-4 transition-all duration-200">
    <Quote className="absolute top-3 right-3 w-5 h-5 text-muted-foreground/10" />
    
    <div className="flex items-start gap-3">
      <div className={`shrink-0 w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(review.display_name)} flex items-center justify-center`}>
        <span className="text-[11px] font-bold text-primary-foreground">{getInitials(review.display_name)}</span>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground truncate">{review.display_name}</span>
            <StarRating rating={review.rating} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-muted-foreground">{timeAgoShort(review.created_at)}</span>
            {canDelete && (
              <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">{review.message}</p>
      </div>
    </div>
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
    // Read from public view (no user_id exposed)
    const { data: publicData } = await supabase
      .from('reviews_public')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    // If logged in, also fetch own reviews to enable delete
    let ownIds: string[] = [];
    if (user) {
      const { data: ownData } = await supabase
        .from('reviews')
        .select('id')
        .eq('user_id', user.id);
      ownIds = (ownData ?? []).map((r: any) => r.id);
    }
    
    setReviews((publicData as Review[])?.map(r => ({ ...r, isOwn: ownIds.includes(r.id) })) || []);
    setLoading(false);
  };

  useEffect(() => { fetchReviews(); }, []);

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
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length)
    : null;

  const ratingDist = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    pct: reviews.length > 0 ? (reviews.filter(r => r.rating === star).length / reviews.length) * 100 : 0,
  }));

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground">Omdömen</span>
        </div>
        {reviews.length > 0 && (
          <span className="text-[10px] text-muted-foreground">{reviews.length} omdömen</span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Rating summary */}
        {avgRating !== null && (
          <div className="flex items-center gap-5 pb-4 border-b border-border">
            <div className="text-center">
              <div className="text-3xl font-bold font-mono-data text-foreground">{avgRating.toFixed(1)}</div>
              <StarRating rating={Math.round(avgRating)} size="md" />
              <div className="text-[10px] text-muted-foreground mt-1">{reviews.length} st</div>
            </div>
            <div className="flex-1 space-y-1">
              {ratingDist.map(({ star, count, pct }) => (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-3 text-right">{star}</span>
                  <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-4">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit form */}
        {user ? (
          <form onSubmit={handleSubmit} className="space-y-3 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className={`shrink-0 w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(displayName || user.email || 'U')} flex items-center justify-center`}>
                <span className="text-[10px] font-bold text-primary-foreground">
                  {displayName ? getInitials(displayName) : <UserCircle className="w-4 h-4" />}
                </span>
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Ditt namn (valfritt)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={50}
                  className="w-full px-3 py-1.5 bg-muted/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] text-muted-foreground">Betyg:</span>
              <StarRating rating={rating} onRate={setRating} interactive size="md" />
            </div>
            <textarea
              placeholder="Berätta om din upplevelse..."
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none transition"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{message.length}/500</span>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-50"
              >
                {submitting ? 'Skickar...' : 'Publicera omdöme'}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-[11px] text-muted-foreground pb-4 border-b border-border">
            Logga in för att lämna ett omdöme.
          </p>
        )}

        {/* Reviews list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse bg-muted/30 rounded-xl h-20" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Inga omdömen ännu. Bli först!</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {reviews.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                canDelete={user?.id === r.user_id}
                onDelete={() => handleDelete(r.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewSection;
