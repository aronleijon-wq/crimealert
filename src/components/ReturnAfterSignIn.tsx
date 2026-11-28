// After Google's or Apple's sign-in page the site opens at its start: this takes you on to the
// page that asked you to sign in (lib/afterSignIn), once, when the sign-in has just happened.
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { takeNext } from '@/lib/afterSignIn';

const ReturnAfterSignIn = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const wasSignedIn = useRef<boolean | null>(null);
  useEffect(() => {
    if (loading) return;
    const signedIn = Boolean(user);
    if (wasSignedIn.current !== true && signedIn) {
      const next = takeNext();
      if (next && next !== window.location.pathname + window.location.search) navigate(next, { replace: true });
    }
    wasSignedIn.current = signedIn;
  }, [user, loading, navigate]);
  return null;
};

export default ReturnAfterSignIn;
