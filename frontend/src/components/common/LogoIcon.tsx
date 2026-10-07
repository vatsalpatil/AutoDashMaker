import { useId, type SVGProps } from 'react';
import { LOGO_CUT_PATH, LOGO_D_PATH } from '@/lib/logo';

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
          <path d={LOGO_CUT_PATH} stroke="black" strokeWidth="1.7" strokeLinecap="round" />
        </mask>
      </defs>
      <path
        mask={`url(#${id}m)`} fill={`url(#${id}g)`} fillRule="evenodd"
        d={LOGO_D_PATH}
      />
    </svg>
  );
};
