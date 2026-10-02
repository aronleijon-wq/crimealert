import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Fades and lifts its content into place the first time it scrolls into view. */
const Reveal = ({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setVisible(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`ca-reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ '--ca-reveal-delay': `${delay}s` } as React.CSSProperties}
    >
      {children}
    </div>
  );
};

export default Reveal;
