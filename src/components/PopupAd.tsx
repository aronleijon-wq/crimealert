import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative bg-card border border-border rounded-xl shadow-2xl max-w-md w-[90vw] overflow-hidden">
        <button
          onClick={() => setVisible(false)}
          className="absolute top-3 right-3 z-10 p-1 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground transition"
          aria-label="Stäng"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 text-center space-y-4">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Annons</div>
          <h2 className="text-xl font-bold text-foreground">📰 SveaPress</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Håll dig uppdaterad med de senaste nyheterna från Sverige och världen. Snabbt, pålitligt och gratis.
          </p>
          <a
            href="https://sveapress.lovable.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block w-full bg-primary text-primary-foreground font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition"
          >
            Besök SveaPress →
          </a>
          <button
            onClick={() => setVisible(false)}
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            Stäng annonsen
          </button>
        </div>
      </div>
    </div>
  );
};

export default PopupAd;
