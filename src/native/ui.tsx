// The iPhone app's own building blocks, drawn like iOS's: grouped lists, switches and a
// segmented control. Only the app's screens (src/native) use them.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, type LucideIcon } from 'lucide-react';

/** A screen of the app: black, with iOS's large title */
export const Screen = ({ title, children }: { title?: string; children: ReactNode }) => (
  <div className="ios min-h-full bg-black pb-10 text-white">
    {title && <h1 className="ios-large-title px-5 pb-2 pt-3">{title}</h1>}
    {children}
  </div>
);

/** An inset grouped list, as in the Settings app */
export const Section = ({ header, footer, children }: { header?: string; footer?: ReactNode; children: ReactNode }) => (
  <section className="mx-4 mt-7 first:mt-4">
    {header && <h2 className="mb-1.5 px-4 text-[13px] uppercase tracking-[0.02em] text-[rgba(235,235,245,0.6)]">{header}</h2>}
    <div className="ios-group overflow-hidden rounded-xl bg-[#1c1c1e]">{children}</div>
    {footer && <p className="mt-1.5 px-4 text-[13px] leading-snug text-[rgba(235,235,245,0.6)]">{footer}</p>}
  </section>
);

interface RowProps {
  icon?: LucideIcon;
  /** The icon's square, coloured as Settings does */
  iconBg?: string;
  label: ReactNode;
  /** A second, smaller line */
  detail?: ReactNode;
  /** Grey text on the right */
  value?: ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  accessory?: ReactNode;
  tint?: boolean;
  destructive?: boolean;
  center?: boolean;
}

/** One row of a list: a link, a button, or a label with a control on the right */
export const Row = ({ icon: Icon, iconBg = '#ff453a', label, detail, value, to, href, onClick, accessory, tint, destructive, center }: RowProps) => {
  const pressable = Boolean(to || href || onClick);
  const content = (
    <span className={`ios-row flex min-h-[44px] w-full items-center gap-3 pl-4 text-left ${pressable ? 'active:bg-[#2c2c2e]' : ''}`}>
      {Icon && (
        <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px]" style={{ background: iconBg }}>
          <Icon className="h-[18px] w-[18px] text-white" strokeWidth={2} aria-hidden />
        </span>
      )}
      <span className="ios-row-body flex min-h-[44px] min-w-0 flex-1 items-center gap-2 py-2.5 pr-4">
        <span className={`min-w-0 flex-1 ${center ? 'text-center' : ''}`}>
          <span className={`block text-[17px] leading-[22px] ${destructive ? 'text-[#ff453a]' : tint ? 'text-[#ff453a]' : 'text-white'}`}>{label}</span>
          {detail && <span className="mt-0.5 block text-[13px] leading-[18px] text-[rgba(235,235,245,0.6)]">{detail}</span>}
        </span>
        {value !== undefined && <span className="shrink-0 text-[17px] text-[rgba(235,235,245,0.6)]">{value}</span>}
        {accessory}
        {(to || href) && !accessory && <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[rgba(235,235,245,0.3)]" strokeWidth={2.5} aria-hidden />}
      </span>
    </span>
  );
  if (to) return <Link to={to} className="block">{content}</Link>;
  if (href) return <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="block">{content}</a>;
  if (onClick) return <button type="button" onClick={onClick} className="block w-full">{content}</button>;
  return <div>{content}</div>;
};

/** iOS's on/off switch */
export const Switch = ({ checked, onChange, disabled, label }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; label: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
    className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${checked ? 'bg-[#30d158]' : 'bg-[#39393d]'}`}
  >
    <span className={`absolute left-0 top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_3px_1px_rgba(0,0,0,0.06)] transition-transform duration-200 ${checked ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
  </button>
);

/** iOS's segmented control */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="mx-4 flex rounded-[9px] bg-[rgba(118,118,128,0.24)] p-[2px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`flex-1 truncate rounded-[7px] px-1 py-[6px] text-[13px] font-semibold transition ${o.value === value ? 'bg-[#636366] text-white shadow' : 'text-white/90'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
