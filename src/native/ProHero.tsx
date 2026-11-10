// The logo with its beacon (pro.css): two beams in the emergency lights' blue and red turning
// behind it, radar rings going out, and events blipping around. On the Pro page and in the
// welcome after a purchase.
import './pro.css';

export const PRO_LOGO = '/lovable-uploads/c2e577a8-2adc-46ca-b331-79142ec40f70.png';

const BLIPS = [
  { left: '8%', top: '30%', color: '#4aa1ff', delay: '0s' },
  { left: '84%', top: '20%', color: '#ff5b4f', delay: '1.3s' },
  { left: '78%', top: '80%', color: '#4aa1ff', delay: '2.4s' },
  { left: '16%', top: '84%', color: '#ff5b4f', delay: '3.3s' },
];

const ProHero = ({ size = 148 }: { size?: number }) => (
  <div className="ca-pro-hero" style={{ transform: size === 148 ? undefined : `scale(${size / 148})` }} aria-hidden>
    <span className="ca-pro-beam" />
    {[0, 1.2, 2.4].map((d) => <span key={d} className="ca-pro-ring" style={{ ['--d' as string]: `${d}s` }} />)}
    {BLIPS.map((b) => (
      <span key={b.delay} className="ca-pro-blip" style={{ left: b.left, top: b.top, ['--c' as string]: b.color, ['--d' as string]: b.delay }} />
    ))}
    <img src={PRO_LOGO} alt="" className="ca-pro-logo" width={72} height={72} />
  </div>
);

export default ProHero;
