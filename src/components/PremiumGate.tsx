import { Lock, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PremiumGateProps {
  title: string;
  description: string;
}

const PremiumGate = ({ title, description }: PremiumGateProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{description}</p>
        <button
          onClick={() => navigate('/account')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 transition glow-red"
        >
          <Zap className="w-4 h-4" /> Uppgradera till Pro — 19 kr/mån
        </button>
      </div>
    </div>
  );
};

export default PremiumGate;
