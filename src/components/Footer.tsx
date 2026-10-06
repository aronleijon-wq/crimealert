import { Link } from 'react-router-dom';
import { Shield, FileText, Cookie, Info, BookOpen } from 'lucide-react';

const Footer = () =>
<footer className="border-t border-border bg-card px-4 my-0 py-[2px]">
    <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
      <span className="text-[10px] text-muted-foreground font-mono">
        © {new Date().getFullYear()} CrimeAlert — Säkerhetskarta åt allmänheten
      </span>
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <Link to="/sekretesspolicy" className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground transition">
          <Shield className="w-3 h-3" />
          Privacy policy
        </Link>
        <Link to="/villkor" className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground transition">
          <FileText className="w-3 h-3" />
          Terms of use
        </Link>
        <Link to="/cookies" className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground transition">
          <Cookie className="w-3 h-3" />
          Cookies
        </Link>
        <Link to="/om-oss" className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground transition">
          <Info className="w-3 h-3" />
          Om oss
        </Link>
        <Link to="/guider" className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground transition">
          <BookOpen className="w-3 h-3" />
          Guider
        </Link>
      </nav>
    </div>
  </footer>;


export default Footer;