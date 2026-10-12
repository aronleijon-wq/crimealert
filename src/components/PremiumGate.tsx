import { Lock, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { TRIAL_DAYS } from '@/components/account/plans';
import { useAuth } from '@/hooks/useAuth';

interface PremiumGateProps {
  title: string;
  description: string;
  /** Something free users can look at instead */
  free?: { to: string; label: string };
}

const PremiumGate = ({ title, description, free }: PremiumGateProps) => {
  const navigate = useNavigate();
  const { user, subscription } = useAuth();
  const offerTrial = !user || subscription.trialEligible === true;

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{description}</p>
        <button
          onClick={() => navigate('/prisplan')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 transition glow-red"
        >
          <Zap className="w-4 h-4" /> {offerTrial ? `Prova Pro gratis i ${TRIAL_DAYS} dagar` : 'Uppgradera till Pro'}
        </button>
        {free && (
          <p className="mt-5 text-sm">
            <Link to={free.to} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">{free.label}</Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default PremiumGate;
