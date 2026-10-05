import { Link, useLocation } from 'react-router-dom';
import { User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';
import DefaultAvatar from '@/components/DefaultAvatar';

/**
 * The profile picture in the header: the classic default picture (a grey circle with a white
 * figure), with a red ring for Pro, opening the profile and settings. Signed out, it's the way to
 * sign in.
 */
const ProfileButton = ({ className = 'h-8 w-8' }: { className?: string }) => {
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const { pathname } = useLocation();

  if (!user) {
    return (
      <Link
        to="/auth"
        aria-label="Logga in"
        className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground md:px-3 md:text-xs"
      >
        <User className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Logga in</span>
      </Link>
    );
  }

  const current = pathname === '/installningar';
  return (
    <Link
      to="/installningar"
      aria-label="Profil och inställningar"
      title="Profil och inställningar"
      aria-current={current ? 'page' : undefined}
      className={`block shrink-0 rounded-full transition hover:opacity-85 ${
        isPremium ? 'ring-2 ring-primary' : current ? 'ring-2 ring-primary/40' : ''
      } ${className}`}
    >
      <DefaultAvatar className="h-full w-full" />
    </Link>
  );
};

export default ProfileButton;
