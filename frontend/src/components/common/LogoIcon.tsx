import { useId, type SVGProps } from 'react';

/** Dashtor logo: a solid "D" with a diagonal cut. The cut is a mask (transparent on any background); the gradient is built from the theme's --primary, so it re-colours with the theme. */
export const LogoIcon = (p: SVGProps<SVGSVGElement>) => {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...p}>
      <defs>
        <linearGradient id={`${id}g`} x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'color-mix(in oklab, var(--primary) 62%, black)' }} />
          <stop offset="1" style={{ stopColor: 'color-mix(in oklab, var(--primary) 70%, white)' }} />
        </linearGradient>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" />
          <path d="M3.9 15 13.2 2.2" stroke="black" strokeWidth="1.7" strokeLinecap="round" />
        </mask>
      </defs>
      <path
        mask={`url(#${id}m)`} fill={`url(#${id}g)`} fillRule="evenodd"
        d="M4.5 3h7.2a9 9 0 0 1 0 18H4.5zM8.7 7.3v9.4h3a4.7 4.7 0 0 0 0-9.4z"
      />
    </svg>
  );
};
