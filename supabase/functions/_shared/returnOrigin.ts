// Where Stripe sends people back to after checkout or the billing portal. The address comes from
// the request's Origin header, which anyone calling the function can set; an unchecked one would let
// a scammer make a real Stripe link that ends on their own lookalike site. So only our own sites
// are used, and anything else goes to the live site.

export const SITE_ORIGIN = 'https://crimealert.se';

// The Lovable project's own preview and published addresses carry its id or name, so no other
// Lovable project can use them
const LOVABLE_PROJECT_ID = 'c9c5629c-ccab-4cdc-9797-2cb282162906';

const ALLOWED: RegExp[] = [
  /^https:\/\/(www\.)?crimealert\.se$/,
  /^https:\/\/(preview--)?crimealert\.lovable\.app$/,
  new RegExp(`^https://([a-z0-9-]+--)?${LOVABLE_PROJECT_ID}\\.(lovable\\.app|lovableproject\\.com)$`),
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/,
];

/** The request's origin if it is one of our sites, else the live site. */
export function returnOrigin(origin: string | null | undefined): string {
  if (!origin) return SITE_ORIGIN;
  const candidate = origin.trim().toLowerCase();
  return ALLOWED.some((pattern) => pattern.test(candidate)) ? candidate : SITE_ORIGIN;
}
