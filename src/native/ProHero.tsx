// The logo on the Pro page and in the welcome after a purchase, with a slow radar ring (pro.css)
import './pro.css';

/** The mark alone, without the app icon's dark square, so it sits on the page instead of on top of it */
export const PRO_LOGO = '/logo-mark.png';

const ProHero = () => (
  <div className="ca-pro-hero" aria-hidden>
    {[0, 2.4].map((d) => <span key={d} className="ca-pro-ring" style={{ ['--d' as string]: `${d}s` }} />)}
    <img src={PRO_LOGO} alt="" className="ca-pro-logo" width={84} height={84} />
  </div>
);

export default ProHero;
