// CrimeAlert Pro on Profil, as a row in the same grouped style as the rest of the page: what it
// gives and a way to get it for those without Pro, that they have it and until when for members.
import { Link } from 'react-router-dom';
import { BadgeCheck, ChevronRight } from 'lucide-react';
import { haptics } from './haptics';
import LogoMark from './LogoMark';

interface Props {
  isPremium: boolean;
  /** "t.o.m. 2026-12-01", "livstid": what the plan is, without the word Pro */
  plan?: string;
  /** Pro can be bought in this app version (lib/native canSellPro) */
  canBuy: boolean;
}

const ProCard = ({ isPremium, plan, canBuy }: Props) => (
  <section className="mx-4 mt-7 first:mt-4">
    <Link
      to="/prisplan"
      onClick={() => haptics.impact()}
      className="flex items-center gap-3.5 rounded-xl bg-[#1c1c1e] px-4 py-3.5 active:bg-[#2c2c2e]"
      aria-label={isPremium ? 'CrimeAlert Pro, ditt medlemskap' : 'CrimeAlert Pro, se vad som ingår'}
    >
      <LogoMark size={40} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[17px] font-semibold text-white">
          {isPremium ? 'Du har Pro' : 'CrimeAlert Pro'}
          {isPremium && <BadgeCheck className="h-[17px] w-[17px] text-[#30d158]" aria-hidden />}
        </span>
        <span className="block truncate text-[14px] text-[rgba(235,235,245,0.6)]">
          {isPremium ? (plan ? `Gäller ${plan}` : 'Allt är upplåst') : 'Händelser och notiser direkt'}
        </span>
      </span>
      {!isPremium && canBuy ? (
        <span className="shrink-0 rounded-full bg-[#ff453a] px-3.5 py-1.5 text-[14px] font-semibold text-white">Skaffa</span>
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0 text-[rgba(235,235,245,0.3)]" aria-hidden />
      )}
    </Link>
  </section>
);

export default ProCard;
