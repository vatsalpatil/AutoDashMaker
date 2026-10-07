import { useId, type SVGProps } from 'react';

/** Dashtor logo: a dashboard window (header dots, ring, bars). Gradient is built from the theme's --primary, so it re-colours with the theme. */
export const LogoIcon = (p: SVGProps<SVGSVGElement>) => {
  const id = useId();
  const stroke = `url(#${id})`;
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      <defs>
        <linearGradient id={id} x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'color-mix(in oklab, var(--primary) 62%, black)' }} />
          <stop offset="1" style={{ stopColor: 'color-mix(in oklab, var(--primary) 70%, white)' }} />
        </linearGradient>
      </defs>
      <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="4.2" stroke={stroke} strokeWidth="1.6" />
      <path d="M2.8 8.1h18.4" stroke={stroke} strokeWidth="1.6" />
      <rect x="4.9" y="4.6" width="2.6" height="1.8" rx=".9" fill={stroke} />
      <rect x="8.2" y="4.6" width="2.6" height="1.8" rx=".9" fill={stroke} />
      <circle cx="8" cy="14.6" r="2.5" stroke={stroke} strokeWidth="1.5" />
      <path d="M13.6 15.1v1.8M16 12.2v4.7M18.4 14.2v2.7" stroke={stroke} strokeWidth="1.7" />
    </svg>
  );
};
