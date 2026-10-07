import type { SVGProps } from 'react';

/** App logo: Tabler "chart-pie-3" (MIT). Stroke follows currentColor. */
export const LogoIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
    <path d="M12 3v9l-6.5 6.5" />
    <path d="M12 12h9" />
  </svg>
);
