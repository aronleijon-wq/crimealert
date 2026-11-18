import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import SocialLinks from '@/components/SocialLinks';
import { Shield, FileText, Cookie, Info, BookOpen, BarChart3, MessageSquareHeart, Building2 } from 'lucide-react';
import { COMPANY, COMPANY_ADDRESS } from '@/lib/company';

// "Tyck till": the same sheet as in the app, loaded when it is opened
const FeedbackSheet = lazy(() => import('@/native/FeedbackSheet'));

const Footer = () => {
  const [feedback, setFeedback] = useState(false);
  return (
<footer className="border-t border-border bg-card px-4 my-0 py-[2px]">
    <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
      <span className="text-[10px] leading-relaxed text-muted-foreground font-mono text-center sm:text-left">
        © {new Date().getFullYear()} {COMPANY.name} · Org.nr {COMPANY.orgNr}
        <br className="sm:hidden" />
        <span className="hidden sm:inline"> · </span>
        {COMPANY_ADDRESS} · <a href={`mailto:${COMPANY.email}`} className="hover:text-foreground">{COMPANY.email}</a>
      </span>
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <Link to="/sekretesspolicy" className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground transition">
          <Shield className="w-3 h-3" />
          Sekretesspolicy
        </Link>
        <Link to="/villkor" className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground transition">
          <FileText className="w-3 h-3" />
          Villkor
        </Link>
        <Link to="/cookies" className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground transition">
          <Cookie className="w-3 h-3" />
          Cookies
        </Link>
        <Link to="/om-oss" className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground transition">
          <Info className="w-3 h-3" />
          Om oss
        </Link>
        <Link to="/for-kommuner" className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground transition">
          <Building2 className="w-3 h-3" />
          För kommuner
        </Link>
        <Link to="/guider" className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground transition">
          <BookOpen className="w-3 h-3" />
          Guider
        </Link>
        <Link to="/statistik" className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground transition">
          <BarChart3 className="w-3 h-3" />
          Statistik
        </Link>
        <button type="button" onClick={() => setFeedback(true)} className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground transition">
          <MessageSquareHeart className="w-3 h-3" />
          Tyck till
        </button>
      </nav>
      <SocialLinks size={26} />
    </div>
    {feedback && <Suspense fallback={null}><FeedbackSheet onClose={() => setFeedback(false)} /></Suspense>}
  </footer>
  );
};


export default Footer;