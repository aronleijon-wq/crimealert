// The logo on the Pro page and in the welcome after a purchase, with a slow radar ring (pro.css)
import LogoMark from './LogoMark';
import './pro.css';

const ProHero = () => (
  <div className="ca-pro-hero" aria-hidden>
    {[0, 2.4].map((d) => <span key={d} className="ca-pro-ring" style={{ ['--d' as string]: `${d}s` }} />)}
    <LogoMark size={84} lit className="ca-pro-logo" />
  </div>
);

export default ProHero;
