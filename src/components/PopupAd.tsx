import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import sveapressBanner from '@/assets/sveapress-banner.png';

const PopupAd = () => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(true);
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="relative bg-white rounded-lg shadow-2xl max-w-md w-[90vw] overflow-hidden">
        {/* Header: ANNONS + X */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-neutral-500">
            ANNONS
          </span>
          <button
            onClick={() => setVisible(false)}
            className="p-1 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition"
            aria-label="Stäng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner image */}
        <div className="mx-5 rounded-lg overflow-hidden">
          <a href="https://sveapress.lovable.app" target="_blank" rel="noopener noreferrer">
            <img
              src={sveapressBanner}
              alt="Svea Press – Alla perspektiv. Ingen agenda."
              className="w-full h-auto"
            />
          </a>
        </div>

        {/* Content */}
        <div className="px-5 pt-4 pb-2 text-center">
          <h2 className="text-xl font-bold text-neutral-900 mb-1">
            SveaPress 📰
          </h2>
          <p className="text-sm text-neutral-500 mb-4">
            Sveriges nyhetssajt – snabbt, pålitligt och gratis
          </p>
        </div>

        {/* CTA Button */}
        <div className="px-5 pb-3">
          <a
            href="https://sveapress.lovable.app"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-3 bg-[hsl(var(--primary))] text-white font-semibold rounded-lg hover:opacity-90 transition text-sm"
          >
            Gå till SveaPress
          </a>
        </div>

        {/* Footer: upgrade link */}
        <div className="px-5 pb-4 pt-1 text-center">
          <span className="text-xs text-neutral-400">Trött på reklam? </span>
          <button
            onClick={() => {
              setVisible(false);
              navigate('/account');
            }}
            className="text-xs text-neutral-500 underline hover:text-neutral-700 transition"
          >
            Uppgradera till Premium
          </button>
        </div>
      </div>
    </div>
  );
};

export default PopupAd;
