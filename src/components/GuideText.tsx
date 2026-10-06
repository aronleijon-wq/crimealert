import { Link } from 'react-router-dom';
import { parseLinks } from '@/content/guides';

const linkClass = 'text-[hsl(var(--ca-text))] underline decoration-[hsl(var(--ca-red))] underline-offset-4 hover:decoration-2';

/** Guide text with its [links](/karta): internal ones in the app, others in a new tab. */
const GuideText = ({ text }: { text: string }) => (
  <>
    {parseLinks(text).map((part, i) =>
      typeof part === 'string' ? (
        part
      ) : part.href.startsWith('/') ? (
        <Link key={i} to={part.href} className={linkClass}>{part.label}</Link>
      ) : (
        <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className={linkClass}>{part.label}</a>
      ),
    )}
  </>
);

export default GuideText;
