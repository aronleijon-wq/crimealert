// The blue dot for where you are, as in the Maps app: the same look on Apple's map (AppleMap) and
// on the site's own map (MapView). The accuracy ring is drawn by each map in metres.

/** The dot's size in px, its white edge included */
export const MY_DOT_SIZE = 22;
export const MY_BLUE = '#0a84ff';

export const MY_DOT_HTML = `<span class="ca-me" aria-label="Du är här" role="img"><span class="ca-me-halo"></span><span class="ca-me-dot"></span></span>`;

export const MY_DOT_CSS = `
.ca-me { position: relative; display: block; width: ${MY_DOT_SIZE}px; height: ${MY_DOT_SIZE}px; pointer-events: none; }
.ca-me-dot { position: absolute; inset: 0; border-radius: 50%; background: ${MY_BLUE}; border: 3px solid #fff; box-shadow: 0 1px 6px rgba(0,0,0,.45); }
.ca-me-halo { position: absolute; inset: 0; border-radius: 50%; background: ${MY_BLUE}; opacity: .35; animation: ca-me-halo 2s ease-out infinite; }
@keyframes ca-me-halo { 0% { transform: scale(1); opacity: .45; } 100% { transform: scale(3.2); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .ca-me-halo { animation: none; opacity: .2; transform: scale(1.8); } }
`;

/** The dot's styles, once for the page */
export function addMyDotStyles() {
  if (typeof document === 'undefined' || document.getElementById('ca-me-styles')) return;
  const style = document.createElement('style');
  style.id = 'ca-me-styles';
  style.textContent = MY_DOT_CSS;
  document.head.appendChild(style);
}
