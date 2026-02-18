import { useIsPremium } from '@/hooks/useIsPremium';
import { X, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdBanner = () => {
  const { isPremium } = useIsPremium();
  const navigate = useNavigate();

  if (isPremium) return null;

  return (
    <div className="bg-muted/80 border-b border-border px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Annons</span>
        <a href="https://nordbrick.se" target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:underline">
          ​NORDBRICK.SE – Sveriges LEGO-hub för riktiga byggare.
        </a>
      </div>
      <button
        onClick={() => navigate('/account')}
        className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline">

        <Zap className="w-3 h-3" /> Ta bort annonser
      </button>
    </div>);

};

export default AdBanner;