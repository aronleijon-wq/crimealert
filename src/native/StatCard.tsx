import type { ReactNode } from 'react';

export const MUTED = 'text-[rgba(235,235,245,0.6)]';
export const FAINT = 'text-[rgba(235,235,245,0.3)]';

/** A grouped card on Statistik, with its header above and a note below, as in iOS Settings */
export const Card = ({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) => (
  <section className="mx-4 mt-6">
    {title && <h2 className={`mb-1.5 px-1 text-[13px] uppercase tracking-[0.02em] ${MUTED}`}>{title}</h2>}
    <div className="rounded-2xl bg-[#1c1c1e] p-4">{children}</div>
    {footer && <p className={`mt-1.5 px-1 text-[13px] leading-snug ${MUTED}`}>{footer}</p>}
  </section>
);
