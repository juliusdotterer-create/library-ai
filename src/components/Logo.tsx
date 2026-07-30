export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="archiv-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--primary-soft)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#archiv-logo)" />
      <path
        d="M8 12.5h6.2l1.8 2h8V22a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 8 22z"
        fill="var(--primary-foreground)"
        opacity="0.92"
      />
      <path
        d="M8 12.5V10a1.5 1.5 0 0 1 1.5-1.5h4.2l1.6 2"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}
