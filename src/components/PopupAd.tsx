import { useState, useEffect } from 'react';
import { X, Newspaper } from 'lucide-react';

const PopupAd = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(true);
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative bg-gradient-to-br from-card to-muted/50 border border-border/50 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] max-w-sm w-[85vw] overflow-hidden">
        {/* Close X button */}
        <button
          onClick={() => setVisible(false)}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-110"
          aria-label="Stäng"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-primary/20" />

        <div className="p-6 pt-5 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-1">
            <Newspaper className="w-6 h-6 text-primary" />
          </div>

          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">Annons</p>
            <h2 className="text-lg font-bold text-foreground">SveaPress</h2>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Senaste nyheterna från Sverige och världen – snabbt, pålitligt och gratis.
          </p>

          <a
            href="https://sveapress.lovable.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground font-semibold py-2.5 px-5 rounded-lg hover:bg-primary/90 transition-all duration-200 text-sm"
          >
            Besök SveaPress
            <span className="text-primary-foreground/70">→</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default PopupAd;
