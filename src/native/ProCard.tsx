// CrimeAlert Pro at the top of Profil: for those without Pro, what it gives and a way to get it,
// lit by the emergency lights (pro.css); for those with Pro, that they have it and until when.
import { Link } from 'react-router-dom';
import { BadgeCheck, BellRing, ChevronRight, FileText, Zap } from 'lucide-react';
import { haptics } from './haptics';
import { PRO_LOGO } from './ProHero';
import './pro.css';

const PERKS = [
  { icon: Zap, text: 'Händelser direkt' },
  { icon: BellRing, text: 'Notiser utan väntan' },
  { icon: FileText, text: 'Hela beskrivningen' },
];

interface Props {
  isPremium: boolean;
  /** "t.o.m. 2026-12-01", "livstid": what the plan is, without the word Pro */
  plan?: string;
  /** Pro can be bought in this app version (lib/native canSellPro) */
  canBuy: boolean;
}

const ProCard = ({ isPremium, plan, canBuy }: Props) => (
  <Link to="/prisplan" onClick={() => haptics.impact()} className="ca-pro ca-pro-card mx-4 mt-4 block transition active:scale-[0.98]" aria-label={isPremium ? 'CrimeAlert Pro, ditt medlemskap' : 'CrimeAlert Pro, se vad som ingår'}>
    <span className="ca-pro-light ca-pro-light-blue" aria-hidden />
    <span className="ca-pro-light ca-pro-light-red" aria-hidden />
    {isPremium ? (
      <span className="relative flex items-center gap-3.5 px-4 py-3.5">
        <img src={PRO_LOGO} alt="" width={44} height={44} className="h-11 w-11 rounded-[13px] shadow-[0_0_0_1px_rgba(255,255,255,0.12)]" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[17px] font-semibold text-white">
            Du har <span className="ca-pro-text">Pro</span>
            <BadgeCheck className="h-[18px] w-[18px] text-[#4aa1ff]" aria-hidden />
          </span>
          <span className="block truncate text-[13px] text-white/60">{plan ? `Gäller ${plan}` : 'Allt är upplåst'}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/35" aria-hidden />
      </span>
    ) : (
      <span className="relative block p-4">
        <span className="flex items-center gap-3">
          <img src={PRO_LOGO} alt="" width={44} height={44} className="h-11 w-11 rounded-[13px] shadow-[0_0_0_1px_rgba(255,255,255,0.12)]" />
          <span className="min-w-0 flex-1">
            <span className="block text-[19px] font-bold leading-tight tracking-tight text-white">CrimeAlert <span className="ca-pro-text">Pro</span></span>
            <span className="block text-[14px] text-white/65">Allt som händer, direkt när det händer</span>
          </span>
        </span>
        <span className="mt-3.5 flex flex-wrap gap-1.5">
          {PERKS.map(({ icon: Icon, text }) => (
            <span key={text} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1 text-[12.5px] font-medium text-white/85">
              <Icon className="h-3.5 w-3.5 text-[#8fb8ff]" strokeWidth={2.4} aria-hidden />{text}
            </span>
          ))}
        </span>
        <span className="ca-pro-cta mt-4 flex h-11 w-full items-center justify-center text-[16px] font-semibold text-white">
          {canBuy ? 'Skaffa Pro' : 'Se vad som ingår'}
        </span>
      </span>
    )}
  </Link>
);

export default ProCard;
