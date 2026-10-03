import { useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, Copy, Facebook, Mail, MessageCircle, Send, Share2, Smartphone, Twitter, type LucideIcon } from 'lucide-react';
import { copyLink, shareContent, shareEvent, shareTargets, type ShareTarget } from '@/lib/share';

const ICONS: Record<ShareTarget['id'], { icon: LucideIcon; color: string }> = {
  sms: { icon: Smartphone, color: '#34c759' },
  whatsapp: { icon: MessageCircle, color: '#25d366' },
  messenger: { icon: MessageCircle, color: '#0a7cff' },
  telegram: { icon: Send, color: '#229ed9' },
  mail: { icon: Mail, color: '#0a84ff' },
  facebook: { icon: Facebook, color: '#1877f2' },
  x: { icon: Twitter, color: '#111111' },
};

const isTouch = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false);

/**
 * "Dela" for one event: the device's own share sheet where there is one, otherwise our menu with
 * the usual places (Meddelanden, WhatsApp, Mail …) and copying the link.
 */
const ShareButton = ({ event, className = '', compact = false, label = 'Dela' }: {
  event: { id: string; title: string };
  className?: string;
  compact?: boolean;
  label?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const content = shareContent(event);

  const copy = async () => {
    if (await copyLink(content.url)) {
      setCopied(true);
      setTimeout(() => { setCopied(false); setOpen(false); }, 1200);
    }
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation();
            // The share sheet must open straight from the tap, before anything else is awaited
            if ((await shareEvent(event)) === 'unsupported') setOpen(true);
          }}
          className={className}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Share2 className="h-4 w-4" />
          {compact ? <span className="sr-only">{label}</span> : <span>{label}</span>}
        </button>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="top"
          align="center"
          sideOffset={8}
          collisionPadding={12}
          onClick={(e) => e.stopPropagation()}
          // ca-dark brings the app's colours (light or dark) to the menu, which lives outside the page
          className="ca-dark z-[1200] w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-[hsl(var(--ca-line-strong))] p-3 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)] outline-none"
        >
          <p className="truncate px-1 text-[13px] font-semibold">{content.title}</p>
          <p className="truncate px-1 text-[11px] text-[hsl(var(--ca-text-3))]">{content.url.replace(/^https?:\/\//, '')}</p>
          <ul className="mt-3 grid grid-cols-4 gap-1">
            {shareTargets(content, { mobile: isTouch() }).map((target) => {
              const { icon: Icon, color } = ICONS[target.id];
              return (
                <li key={target.id}>
                  <a
                    href={target.href}
                    target={target.href.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-[11px] transition hover:bg-[hsl(var(--ca-panel-3))]"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ background: color }}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="truncate">{target.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={copy}
            className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[hsl(var(--ca-line-strong))] text-sm font-medium transition hover:bg-[hsl(var(--ca-panel-3))]"
          >
            {copied ? <Check className="h-4 w-4 text-[hsl(var(--cr-green))]" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Länken är kopierad' : 'Kopiera länk'}
          </button>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};

export default ShareButton;
