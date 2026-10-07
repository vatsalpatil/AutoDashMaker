/** Filter icon: a wide rounded funnel bowl above a separate slanted spout. Uses currentColor so it follows the text colour. */
export function FunnelIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M2.1 0.8h19.8a1.3 1.3 0 0 1 1 2.1L15.8 10.9H8.6L1.1 2.9A1.3 1.3 0 0 1 2.1 0.8z" />
      <path d="M8.6 12.9l7.2-1.6v10.9a.85.85 0 0 1-1.15.8l-4.1-1.55q-1.95-.7-1.95-2.4z" />
    </svg>
  );
}
